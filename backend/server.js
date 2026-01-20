const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Database (Mock) - We rely on Cloudinary text context for metadata, 
// but we could cache it here if needed. We won't for simplicity.

// --- ROUTES ---

// 1. Auth Check
app.post('/auth', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, token: 'authenticated_session' });
  }
  return res.status(401).json({ success: false, message: 'Invalid password' });
});

// 2. Get Images (from specific folder or root)
app.get('/images', async (req, res) => {
  const { folder } = req.query;
  // Default to root folder if not specified, or specific subfolder
  // Note: prefix must end with '/' to search *inside* folder, otherwise it searches by name prefix
  const prefix = folder && folder !== 'All'
    ? `photo-slider-app/${folder}/`
    : 'photo-slider-app/';

  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: prefix,
      context: true,
      max_results: 100
    });

    const images = result.resources.map(img => ({
      id: img.public_id,
      url: img.secure_url,
      title: img.context?.custom?.title || '',
      description: img.context?.custom?.description || '',
      createdAt: img.created_at
    }));

    res.json(images);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// 2b. Get Albums (Folders)
app.get('/albums', async (req, res) => {
  try {
    const result = await cloudinary.api.sub_folders('photo-slider-app');
    const albums = result.folders.map(f => f.name);
    res.json(albums);
  } catch (error) {
    console.error(error);
    // If folder doesn't exist yet, return empty list instead of error
    if (error.error && error.error.http_code === 404) {
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// 3. Upload Image
app.post('/images/upload', upload.single('image'), (req, res) => {
  const { title, description, folder } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No image file provided' });
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Determine folder: default to 'photo-slider-app' if 'All' or empty
  // If specific folder, use 'photo-slider-app/folderName'
  const cloudinaryFolder = folder && folder !== 'All'
    ? `photo-slider-app/${folder}`
    : 'photo-slider-app';

  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: cloudinaryFolder,
      context: `title=${title}|description=${description}`
    },
    (error, result) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Upload failed' });
      }
      res.json({
        success: true,
        image: {
          id: result.public_id,
          url: result.secure_url,
          title,
          description
        }
      });
    }
  );

  // Pipe the buffer to Cloudinary
  const bufferStream = require('stream').Readable.from(file.buffer);
  bufferStream.pipe(uploadStream);
});

// 3b. Batch Delete Images
app.post('/images/delete-batch', async (req, res) => {
  const { ids } = req.body;
  console.log('Batch Delete Request IDs:', ids);

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    console.log('Batch Delete Unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  try {
    const result = await cloudinary.api.delete_resources(ids);
    console.log('Cloudinary Batch Result:', result);
    res.json({ success: true, message: `Deleted ${ids.length} images` });
  } catch (error) {
    console.error('Batch Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete images', details: error.message });
  }
});

// 4. Delete Image (Single)
app.delete('/images/:id', async (req, res) => {
  const { id } = req.params;

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // The ID sent might be just the name, but we need full public_id if it includes folder
  // Our frontend should send the full public_id (e.g. photo-slider-app/xyz)
  // Express decodes the URL parameter, so if it was 'photo-slider-app%2Fxyz', it becomes 'photo-slider-app/xyz'

  try {
    await cloudinary.uploader.destroy(id);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Single Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// 5. Delete Album (Folder)
app.delete('/albums/:name', async (req, res) => {
  const { name } = req.params;
  console.log('Delete Album Request:', name);

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const folderPath = `photo-slider-app/${name}`;

  try {
    // 1. Delete all resources in the folder
    console.log('Deleting resources in:', folderPath);
    await cloudinary.api.delete_resources_by_prefix(folderPath + '/');

    // 2. Delete the empty folder
    console.log('Deleting folder:', folderPath);
    await cloudinary.api.delete_folder(folderPath);

    res.json({ success: true, message: 'Album deleted' });
  } catch (error) {
    // Check if error is "Folder not empty" or similar
    console.error('Delete Album Error:', error);
    res.status(500).json({ error: 'Failed to delete album', details: error.message });
  }
});

// ... existing code ...

const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// VAPID Config
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:test@test.com',
    publicVapidKey,
    privateVapidKey
  );
}

// Data Stores
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
const REMINDERS_FILE = path.join(__dirname, 'reminders.json');

// Helper to read/write JSON
const readJson = (file) => {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return []; }
};
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// --- Reminder Routes ---

// Subscribe for Notifications
app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  let subs = readJson(SUBS_FILE);
  // Avoid duplicates
  if (!subs.find(s => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    writeJson(SUBS_FILE, subs);
  }
  res.status(201).json({});
});

// Create Reminder
app.post('/reminders', (req, res) => {
  // Auth check
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, time } = req.body; // time in ISO string
  if (!message || !time) return res.status(400).json({ error: 'Missing fields' });

  let reminders = readJson(REMINDERS_FILE);
  const newReminder = { id: Date.now().toString(), message, time, sent: false };
  reminders.push(newReminder);
  writeJson(REMINDERS_FILE, reminders);
  res.json(newReminder);
});

// Get Reminders
app.get('/reminders', (req, res) => {
  // Auth check
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const reminders = readJson(REMINDERS_FILE);
  // Sort by time
  reminders.sort((a, b) => new Date(a.time) - new Date(b.time));
  res.json(reminders);
});

// Delete Reminder
app.delete('/reminders/:id', (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let reminders = readJson(REMINDERS_FILE);
  reminders = reminders.filter(r => r.id !== req.params.id);
  writeJson(REMINDERS_FILE, reminders);
  res.json({ success: true });
});

// --- Scheduler (Runs every minute) ---
cron.schedule('* * * * *', () => {
  const now = new Date();
  let reminders = readJson(REMINDERS_FILE);
  let subs = readJson(SUBS_FILE);
  let modified = false;

  reminders.forEach(reminder => {
    if (!reminder.sent && new Date(reminder.time) <= now) {
      // Time to send!
      const payload = JSON.stringify({ title: 'Reminder', body: reminder.message });

      // Send to ALL subscribers
      subs.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
      });

      reminder.sent = true;
      modified = true;
      console.log(`Sent reminder: ${reminder.message}`);
    }
  });

  if (modified) {
    // Optional: Remove sent reminders or keep them marked as sent
    // For cleanup, let's remove them after sending? Or keep for history.
    // User requested "push notifications", usually you want them gone or marked.
    // Let's keep them but marked sent for now so UI doesn't flicker.
    writeJson(REMINDERS_FILE, reminders);
  }
});

// --- Test Routes ---
app.post('/test-notification', (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subs = readJson(SUBS_FILE);
  if (subs.length === 0) {
    return res.status(400).json({ error: 'No subscriptions found' });
  }

  const payload = JSON.stringify({
    title: 'Test Notification',
    body: 'If you see this, push works!'
  });

  let successCount = 0;
  let failCount = 0;

  Promise.all(subs.map(sub =>
    webpush.sendNotification(sub, payload)
      .then(() => successCount++)
      .catch(err => {
        console.error('Test Push Error:', err);
        failCount++;
      })
  )).then(() => {
    res.json({ success: true, sent: successCount, failed: failCount });
  });
});

app.listen(port, () => {
  console.log(`Backend Server running on port ${port}`);
});
