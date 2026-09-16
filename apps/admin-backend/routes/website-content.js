const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// Get home page content
router.get('/home', async (req, res) => {
  try {
    const content = await prisma.websiteContent.findUnique({
      where: { pageKey: 'home_page' },
    });
    
    if (!content) {
      return res.status(404).json({ success: false, message: 'Home page content not found' });
    }

    res.json({ success: true, data: content.content });
  } catch (error) {
    console.error('Error fetching home page content:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update testimonials on home page
router.put('/home/testimonials', async (req, res) => {
  try {
    const { testimonials } = req.body;
    
    if (!Array.isArray(testimonials)) {
      return res.status(400).json({ success: false, message: 'Testimonials must be an array' });
    }

    // Get current content
    let content = await prisma.websiteContent.findUnique({
      where: { pageKey: 'home_page' },
    });

    let newContent = content ? content.content : {};
    newContent.testimonials = testimonials;

    await prisma.websiteContent.upsert({
      where: { pageKey: 'home_page' },
      update: { content: newContent },
      create: { pageKey: 'home_page', content: newContent },
    });

    res.json({ success: true, message: 'Testimonials updated successfully' });
  } catch (error) {
    console.error('Error updating testimonials:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
