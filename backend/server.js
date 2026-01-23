const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');
const { getDatabase } = require('./db/mongodb');
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

// --- ROUTES ---

// 1. Auth Check
app.post('/auth', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, token: 'authenticated_session' });
  }
  return res.status(401).json({ success: false, message: 'Invalid password' });
});

// 1b. Health Check (Keep-Alive)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 1c. Debug Status (Enhanced)
app.get('/debug-status', async (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// 1d. Full Debug Dump (For User Diagnostics)
app.get('/debug-dump', async (req, res) => {
  res.header('Cache-Control', 'no-store');
  try {
    console.log('=== DEBUG DUMP REQUESTED ===');

    // Get all folders
    const foldersResult = await cloudinary.api.sub_folders('photo-slider-app', { max_results: 500 });

    // Get all resources (including their folders)
    const imagesResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'photo-slider-app/',
      max_results: 500,
      context: true
    });

    // Group images by folder
    const imagesByFolder = {};
    imagesResult.resources.forEach(img => {
      const folderPath = img.folder || 'root';
      if (!imagesByFolder[folderPath]) {
        imagesByFolder[folderPath] = [];
      }
      imagesByFolder[folderPath].push({
        public_id: img.public_id,
        created_at: img.created_at
      });
    });

    res.json({
      timestamp: new Date().toISOString(),
      total_folders: foldersResult.folders.length,
      folders: foldersResult.folders.map(f => f.name),
      total_resources: imagesResult.resources.length,
      images_by_folder: imagesByFolder,
      recent_images: imagesResult.resources.slice(0, 10).map(img => ({
        public_id: img.public_id,
        folder: img.folder,
        created_at: img.created_at,
        url: img.secure_url
      }))
    });
  } catch (error) {
    console.error('Debug dump error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// 2. Get Images (from specific folder or root)
app.get('/images', async (req, res) => {
  const { folder, limit } = req.query;
  const prefix = folder && folder !== 'All'
    ? `photo-slider-app/${folder}/`
    : 'photo-slider-app/';

  res.header('Cache-Control', 'no-store');

  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: prefix,
      context: true,
      max_results: 500,
      direction: 'desc'
    });

    const images = result.resources.map(img => ({
      id: img.public_id,
      url: img.secure_url,
      title: img.context?.custom?.title || '',
      description: img.context?.custom?.description || '',
      title: img.context?.custom?.title || '',
      description: img.context?.custom?.description || '',
      createdAt: img.context?.custom?.date ? new Date(img.context.custom.date).toISOString() : img.created_at
    }));

    res.json(images);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// 2b. Get Albums (Folders)
app.get('/albums', async (req, res) => {
  res.header('Cache-Control', 'no-store');
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'photo-slider-app/',
      max_results: 500
    });

    const folderSet = new Set();
    result.resources.forEach(resource => {
      const parts = resource.public_id.split('/');
      if (parts.length >= 2) {
        const albumName = parts[1];
        if (albumName) {
          folderSet.add(albumName);
        }
      }
    });

    const albums = Array.from(folderSet).sort();
    res.json(albums);
  } catch (error) {
    console.error(error);
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

  const cloudinaryFolder = folder && folder !== 'All'
    ? `photo-slider-app/${folder}`
    : 'photo-slider-app';

  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: cloudinaryFolder,
      context: `title=${title}|description=${description}|date=${req.body.date || ''}`
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

  const bufferStream = require('stream').Readable.from(file.buffer);
  bufferStream.pipe(uploadStream);
});

// 3b. Batch Delete Images
app.post('/images/delete-batch', async (req, res) => {
  const { ids } = req.body;
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }
  try {
    const result = await cloudinary.api.delete_resources(ids);
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
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const folderPath = `photo-slider-app/${name}`;
  try {
    await cloudinary.api.delete_resources_by_prefix(folderPath + '/');
    await cloudinary.api.delete_folder(folderPath);
    res.json({ success: true, message: 'Album deleted' });
  } catch (error) {
    console.error('Delete Album Error:', error);
    res.status(500).json({ error: 'Failed to delete album', details: error.message });
  }
});

// 4b. Update Image Metadata (Title, Description, Date)
app.patch('/images/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, date } = req.body;
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const contextParts = [];
    if (title !== undefined) contextParts.push(`title=${title}`);
    if (description !== undefined) contextParts.push(`description=${description}`);
    if (date !== undefined) contextParts.push(`date=${date}`);
    if (contextParts.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const result = await cloudinary.uploader.explicit(id, {
      type: 'upload',
      context: contextParts.join('|')
    });
    res.json({ success: true, context: result.context });
  } catch (error) {
    console.error('Update Image Error:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// 6. Rename Album (Folder)
app.patch('/albums/:name', async (req, res) => {
  const { name } = req.params;
  const { newName } = req.body;

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!newName || !newName.trim()) return res.status(400).json({ error: 'New name required' });

  const oldPath = `photo-slider-app/${name}`;
  const newPath = `photo-slider-app/${newName.trim()}`;

  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: oldPath + '/',
      max_results: 500,
      context: true
    });

    if (result.resources.length === 0) {
      return res.status(404).json({ error: 'Album empty or not found' });
    }

    const movedImages = [];
    for (const img of result.resources) {
      const filename = img.public_id.split('/').pop();
      const newPublicId = `${newPath}/${filename}`;
      const uploaded = await cloudinary.uploader.upload(img.secure_url, {
        public_id: newPublicId,
        resource_type: 'image',
        overwrite: false,
        context: img.context
      });
      movedImages.push({ old: img.public_id, new: uploaded.public_id });
    }

    for (const moved of movedImages) {
      await cloudinary.uploader.destroy(moved.old);
    }

    try {
      await cloudinary.api.delete_folder(oldPath);
    } catch (e) {
      console.warn('Folder delete warning:', e.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({
      success: true,
      newName: newName.trim(),
      movedCount: movedImages.length
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Rename failed', details: error.message });
  }
});

const webpush = require('web-push');
const cron = require('node-cron');
// Remove fs/path usages in logic, but still imported for file streams maybe
const { readJson, writeJson } = require('./utils/CloudinaryStorage');

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

// Data Stores (Cloudinary Public IDs) - Legacy local files
const SUBS_FILE = 'subscriptions.json';
const REMINDERS_FILE = 'reminders.json';

// --- Reminder Routes ---

// Subscribe for Notifications (MongoDB)
app.post('/subscribe', async (req, res) => {
  const subscription = req.body;

  try {
    const db = await getDatabase();
    const subsCollection = db.collection('subscriptions');

    // Upsert subscription
    await subsCollection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { ...subscription, updatedAt: new Date() } },
      { upsert: true }
    );

    res.status(201).json({});
  } catch (err) {
    console.error('Subscribe Error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Create Reminder (MongoDB)
app.post('/reminders', async (req, res) => {
  // Auth check
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, time, repeatInterval } = req.body;
  if (!message || !time) return res.status(400).json({ error: 'Missing fields' });

  try {
    const db = await getDatabase();
    const newReminder = {
      id: Date.now().toString(),
      message,
      time,
      sent: false,
      isActive: true, // Default to active
      repeatInterval: repeatInterval ? parseInt(repeatInterval) : 0, // 0 means one-time
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('reminders').insertOne(newReminder);
    res.json(newReminder);
  } catch (err) {
    console.error('Create Reminder Error:', err);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// Toggle Reminder Active Status (MongoDB)
app.patch('/reminders/:id/toggle', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { isActive } = req.body;

  try {
    const db = await getDatabase();
    const collection = db.collection('reminders');
    const reminder = await collection.findOne({ id: req.params.id });

    if (reminder) {
      let updates = { isActive: isActive, updatedAt: new Date() };

      if (isActive) {
        updates.sent = false;
        if (reminder.repeatInterval > 0) {
          let nextTime = new Date(reminder.time);
          const now = new Date();
          if (nextTime <= now) {
            while (nextTime <= now) {
              nextTime = new Date(nextTime.getTime() + reminder.repeatInterval * 60000);
            }
            updates.time = nextTime.toISOString();
          }
        }
      }

      await collection.updateOne(
        { id: req.params.id },
        { $set: updates }
      );

      const updatedReminder = await collection.findOne({ id: req.params.id });
      processReminders().catch(e => console.error('Immediate check failed:', e));

      res.json({ success: true, reminder: updatedReminder });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('Toggle Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Get Reminders (MongoDB)
app.get('/reminders', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const db = await getDatabase();
    const reminders = await db.collection('reminders').find({}).toArray();
    reminders.sort((a, b) => new Date(a.time) - new Date(b.time));
    res.json(reminders);
  } catch (err) {
    console.error('Get Reminders Error:', err);
    res.json([]);
  }
});

// Delete Reminder (MongoDB)
app.delete('/reminders/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const db = await getDatabase();
    await db.collection('reminders').deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Reminder Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Reminder Logic (MongoDB) ---
async function processReminders() {
  const now = new Date();
  const logs = [];
  logs.push(`[System] Server Time (UTC): ${now.toISOString().split('.')[0].replace('T', ' ')}`);

  try {
    const db = await getDatabase();
    const remindersCollection = db.collection('reminders');
    const subsCollection = db.collection('subscriptions');

    // 1. Fetch data
    let reminders = await remindersCollection.find({}).toArray();
    let subs = await subsCollection.find({}).toArray();
    let modified = false;

    logs.push(`[Data] Loaded ${reminders.length} reminders, ${subs.length} subscriptions.`);

    // 2. Audit & Process
    for (const reminder of reminders) {
      const reminderTime = new Date(reminder.time);
      const isDue = reminderTime <= now;
      const timeDiff = Math.round((reminderTime - now) / 60000); // Minutes

      const status = !reminder.isActive ? 'INACTIVE ⚪'
        : reminder.sent ? 'ALREADY SENT ✅'
          : isDue ? 'DUE NOW 🔴'
            : `PENDING (in ${timeDiff}m) ⏳`;

      logs.push(`   - "${reminder.message}": ${status}`);

      if (reminder.isActive === false) continue;

      if (!reminder.sent && isDue) {
        const payload = JSON.stringify({
          title: 'SliderApp Reminder',
          body: reminder.message
        });

        let successCount = 0;
        await Promise.all(subs.map(async (sub) => {
          try {
            await webpush.sendNotification(sub, payload);
            successCount++;
          } catch (err) {
            // Remove invalid subscriptions (410 Gone, 404 Not Found)
            if (err.statusCode === 410 || err.statusCode === 404) {
              await subsCollection.deleteOne({ endpoint: sub.endpoint });
              logs.push(`   -> Removed stale sub (Client gone)`);
            }
          }
        }));

        logs.push(`   >>> PUSH SENT to ${successCount} devices! 🚀`);

        if (reminder.repeatInterval && reminder.repeatInterval > 0) {
          let nextTime = new Date(reminderTime.getTime() + reminder.repeatInterval * 60000);
          while (nextTime <= now) {
            nextTime = new Date(nextTime.getTime() + reminder.repeatInterval * 60000);
          }
          logs.push(`   >>> RESCHEDULED for ${nextTime.toISOString()} 🔄`);

          await remindersCollection.updateOne(
            { id: reminder.id },
            { $set: { time: nextTime.toISOString(), sent: false, updatedAt: new Date() } }
          );
        } else {
          await remindersCollection.updateOne(
            { id: reminder.id },
            { $set: { sent: true, updatedAt: new Date() } }
          );
          logs.push(`   >>> MARKED DONE ✅`);
        }
      }
    }
    debugLogs = logs;
  } catch (err) {
    console.error('Process Reminders Error:', err);
    logs.push(`[Error] ${err.message}`);
    debugLogs = logs;
  }
}

// --- Scheduler (Runs every minute) ---
cron.schedule('* * * * *', async () => {
  await processReminders();
});

// --- Self-Ping to Keep Server Alive (14 mins) ---
setInterval(() => {
  const t = new Date();
  if (t.getHours() >= 9 && t.getHours() <= 23) { // Only wake during day if needed, or always
    // Use localhost loopback if possible, or leave it
    // Actually, Render free tier sleeps regardless of internal intervals if no external requests.
    // So this internal ping might not help much unless it makes an outbound request.
    // For now, let's just log.
    console.log('[System] Keep-alive tick');
  }
}, 14 * 60 * 1000);

// --- Debug Trigger Endpoint ---
app.post('/debug-trigger-check', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await processReminders(); // Updates global debugLogs
    res.json({ success: true, logs: debugLogs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger check', details: err.message });
  }
});

// --- Test Routes ---
app.post('/test-notification', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = await getDatabase();
    const subsCollection = db.collection('subscriptions');
    const subs = await subsCollection.find({}).toArray();

    if (subs.length === 0) {
      return res.status(400).json({ error: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title: 'Test Notification',
      body: 'If you see this, push works!',
      icon: '/icon-192x192.png'
    });

    let successCount = 0;
    let failCount = 0;

    await Promise.all(subs.map(sub =>
      webpush.sendNotification(sub, payload)
        .then(() => successCount++)
        .catch(err => {
          console.error('Test Push Error:', err);
          failCount++;
        })
    ));

    res.json({ success: true, sent: successCount, failed: failCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Date Captions - MongoDB
app.get('/date-captions/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const db = await getDatabase();
    const collection = db.collection('date_captions');
    const doc = await collection.findOne({ date });
    res.json({ caption: doc ? doc.caption : '' });
  } catch (err) {
    console.error('Get caption error:', err);
    res.json({ caption: '' });
  }
});

// Save caption for a specific date
app.post('/date-captions/:date', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { date } = req.params;
    const { caption } = req.body;
    const db = await getDatabase();
    const collection = db.collection('date_captions');

    await collection.updateOne(
      { date },
      { $set: { date, caption, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save caption error:', error);
    res.status(500).json({ error: 'Failed to save caption' });
  }
});

app.listen(port, () => {
  console.log(`Backend Server running on port ${port}`);
});
