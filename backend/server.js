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

// 1b. Health Check (Keep-Alive)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 1c. Debug Status (Enhanced)
app.get('/debug-status', async (req, res) => {
  try {
    const start = Date.now();

    // Performance/Health Check
    const subs = await readJson(SUBS_FILE);
    const reminders = await readJson(REMINDERS_FILE);

    // Verify Storage R/W
    let storageTest = 'Skipped';
    try {
      const testId = `test_${Date.now()}`;
      await writeJson('storage_test.json', { testId });

      // Wait 2s for Cloudinary CDN to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      const readBack = await readJson('storage_test.json');
      if (readBack.testId === testId) {
        storageTest = 'OK';
      } else {
        storageTest = `FAILED (Mismatch: Expected ${testId}, Got ${readBack.testId})`;
      }
    } catch (e) {
      storageTest = `ERROR (${e.message})`;
    }

    res.json({
      serverTime: new Date().toISOString(),
      subscriptionCount: subs.length,
      reminderCount: reminders.length,
      storageStatus: storageTest,
      checkDuration: `${Date.now() - start}ms`,
      success: true
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Get Images (from specific folder or root)
app.get('/images', async (req, res) => {
  const { folder, limit } = req.query;
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
      max_results: limit ? parseInt(limit) : 100
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

  try {
    await cloudinary.uploader.destroy(id);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Single Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// 4b. Update Image Metadata
app.patch('/images/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, date } = req.body;

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Build context string for Cloudinary
    const contextParts = [];
    if (title !== undefined) contextParts.push(`title=${title}`);
    if (description !== undefined) contextParts.push(`description=${description}`);
    if (date !== undefined) contextParts.push(`date=${date}`);

    if (contextParts.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update using explicit with context
    const result = await cloudinary.uploader.explicit(id, {
      type: 'upload',
      context: contextParts.join('|')
    });

    res.json({
      success: true,
      context: result.context,
      message: 'Image updated'
    });
  } catch (error) {
    console.error('Update Image Error:', error);
    res.status(500).json({ error: 'Failed to update image', details: error.message });
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

// 6. Rename Album (Folder)
app.patch('/albums/:name', async (req, res) => {
  const { name } = req.params;
  const { newName } = req.body;

  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!newName || newName.trim() === '') {
    return res.status(400).json({ error: 'New name is required' });
  }

  const oldPath = `photo-slider-app/${name}`;
  const newPath = `photo-slider-app/${newName.trim()}`;

  try {
    // 1. Get all resources in old folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: oldPath + '/',
      max_results: 500
    });

    if (result.resources.length === 0) {
      return res.status(404).json({ error: 'Album not found or empty' });
    }

    // 2. Rename each resource (move to new folder)
    for (const resource of result.resources) {
      const oldPublicId = resource.public_id;
      const filename = oldPublicId.split('/').pop();
      const newPublicId = `${newPath}/${filename}`;

      await cloudinary.uploader.rename(oldPublicId, newPublicId);
    }

    // 3. Delete old empty folder
    try {
      await cloudinary.api.delete_folder(oldPath);
    } catch (e) {
      // Folder might auto-delete when empty, ignore error
    }

    res.json({ success: true, newName: newName.trim() });
  } catch (error) {
    console.error('Rename Album Error:', error);
    res.status(500).json({ error: 'Failed to rename album', details: error.message });
  }
});


const webpush = require('web-push');
const cron = require('node-cron');
// Remove fs/path, use Cloudinary Storage
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

// Data Stores (Cloudinary Public IDs)
const SUBS_FILE = 'subscriptions.json';
const REMINDERS_FILE = 'reminders.json';

// --- Reminder Routes ---

// Subscribe for Notifications
app.post('/subscribe', async (req, res) => {
  const subscription = req.body;

  try {
    let subs = await readJson(SUBS_FILE);
    // Avoid duplicates
    if (!subs.find(s => s.endpoint === subscription.endpoint)) {
      subs.push(subscription);
      await writeJson(SUBS_FILE, subs);
    }
    res.status(201).json({});
  } catch (err) {
    console.error('Subscribe Error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Create Reminder
app.post('/reminders', async (req, res) => {
  // Auth check
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, time, repeatInterval } = req.body;
  if (!message || !time) return res.status(400).json({ error: 'Missing fields' });

  try {
    let reminders = await readJson(REMINDERS_FILE);
    const newReminder = {
      id: Date.now().toString(),
      message,
      time,
      sent: false,
      isActive: true, // Default to active
      repeatInterval: repeatInterval ? parseInt(repeatInterval) : 0 // 0 means one-time
    };
    reminders.push(newReminder);
    await writeJson(REMINDERS_FILE, reminders);
    res.json(newReminder);
  } catch (err) {
    console.error('Create Reminder Error:', err);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// Toggle Reminder Active Status
app.patch('/reminders/:id/toggle', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { isActive } = req.body;

  try {
    let reminders = await readJson(REMINDERS_FILE);
    const reminder = reminders.find(r => r.id === req.params.id);

    if (reminder) {
      reminder.isActive = isActive;

      if (isActive) {
        // Reset sent status to ensure it can fire
        reminder.sent = false;

        // Handle Recurring rescheduling
        if (reminder.repeatInterval > 0) {
          let nextTime = new Date(reminder.time);
          const now = new Date();

          // If it's in the past, fast forward
          if (nextTime <= now) {
            while (nextTime <= now) {
              nextTime = new Date(nextTime.getTime() + reminder.repeatInterval * 60000);
            }
            reminder.time = nextTime.toISOString();
          }
        }


      }

      await writeJson(REMINDERS_FILE, reminders);

      // TRIGGER CHECKS IMMEDIATELY (Fixes server sleep delay)
      processReminders().catch(e => console.error('Immediate check failed:', e));

      res.json({ success: true, reminder });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    console.error('Toggle Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Get Reminders
app.get('/reminders', async (req, res) => {
  // Auth check
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const reminders = await readJson(REMINDERS_FILE);
    // Sort by time
    reminders.sort((a, b) => new Date(a.time) - new Date(b.time));
    res.json(reminders);
  } catch (err) {
    console.error('Get Reminders Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Delete Reminder
app.delete('/reminders/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    let reminders = await readJson(REMINDERS_FILE);
    reminders = reminders.filter(r => r.id !== req.params.id);
    await writeJson(REMINDERS_FILE, reminders);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Reminder Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Reminder Logic (Extracted for Manual Triggering) ---
async function processReminders() {
  const now = new Date();
  const logs = [];
  logs.push(`[System] Server Time (UTC): ${now.toISOString().split('.')[0].replace('T', ' ')}`);

  try {
    // 1. Fetch latest data
    let reminders = await readJson(REMINDERS_FILE);
    let subs = await readJson(SUBS_FILE);
    let modified = false;

    logs.push(`[Data] Loaded ${reminders.length} reminders, ${subs.length} subscriptions.`);

    // 2. Audit & Process
    for (const reminder of reminders) {
      const reminderTime = new Date(reminder.time);
      const isDue = reminderTime <= now;
      const timeDiff = Math.round((reminderTime - now) / 60000); // Minutes

      // Detailed Log for Debugging
      const status = !reminder.isActive ? 'INACTIVE ⚪'
        : reminder.sent ? 'ALREADY SENT ✅'
          : isDue ? 'DUE NOW 🔴'
            : `PENDING (in ${timeDiff}m) ⏳`;

      logs.push(`   - "${reminder.message}": ${status} [Target: ${reminderTime.toISOString().split('T')[1].substr(0, 5)}]`);

      // Skip processing if not actionable
      if (reminder.isActive === false) continue;

      if (!reminder.sent && isDue) {
        // Time to send!
        const payload = JSON.stringify({
          title: 'SliderApp Reminder',
          body: reminder.message
        });

        // Send to ALL subscribers
        let successCount = 0;
        let failCount = 0;

        await Promise.all(subs.map(sub =>
          webpush.sendNotification(sub, payload, {
            headers: { 'Urgency': 'high' },
            TTL: 86400 // Keep message alive for 24h if device is offline
          })
            .then(() => successCount++)
            .catch(err => {
              failCount++;
              if (err.statusCode === 410 || err.statusCode === 404) {
                // optionally remove sub
              }
            })
        ));

        // We don't await strictly for the cron, but for debug trigger we might want to wait a bit
        // For simplicity in this sync-like loop, we just fire and forget, logging intent.

        const logMsg = `   -> TRIGGERING PUSH: ${reminder.message}`;
        console.log(logMsg);
        logs.push(logMsg);
        logs.push(`   -> Push Results: ${successCount} Sent, ${failCount} Failed.`);

        // Critical: Only mark as sent/reschedule if we succeeded OR if there are no subs
        if (successCount > 0 || subs.length === 0) {
          // Update Logic
          if (reminder.repeatInterval && reminder.repeatInterval > 0) {
            // Recurring logic...
            let nextTime = new Date(reminderTime.getTime() + reminder.repeatInterval * 60000);
            while (nextTime <= new Date()) {
              nextTime = new Date(nextTime.getTime() + reminder.repeatInterval * 60000);
            }
            reminder.time = nextTime.toISOString();
            reminder.sent = false;
            logs.push(`   -> Rescheduled to: ${reminder.time}`);
          } else {
            // One-time
            reminder.sent = true;
            logs.push(`   -> Marked as Sent`);
          }
          modified = true;
        } else {
          logs.push(`   -> WARNING: All pushes failed (or 0 subs). NOT marking as sent. Will retry next check.`);
        }
      }
    }

    // 3. Save updates
    if (modified) {
      await writeJson(REMINDERS_FILE, reminders);
      logs.push('[System] Storage updated successfully.');
    } else {
      logs.push('[System] No changes needed.');
    }
  } catch (e) {
    const errorMsg = `[Error] ${e.message}`;
    console.error(errorMsg, e);
    logs.push(errorMsg);
  }
  return logs;
}

// --- Scheduler (Runs every minute) ---
cron.schedule('* * * * *', async () => {
  await processReminders();
});

// --- Debug Trigger Endpoint ---
app.post('/debug-trigger-check', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const logs = await processReminders();
    res.json({ success: true, logs });
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
    const subs = await readJson(SUBS_FILE);
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

app.listen(port, () => {
  console.log(`Backend Server running on port ${port}`);
});
