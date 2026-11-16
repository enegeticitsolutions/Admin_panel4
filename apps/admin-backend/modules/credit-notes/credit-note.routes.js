const express = require('express');
const router = express.Router();
const creditNoteController = require('./credit-note.controller');

// GET /api/credit-notes (list with search & filter)
router.get('/', creditNoteController.listCreditNotes);

// GET /api/credit-notes/:id
router.get('/:id', creditNoteController.getCreditNoteById);

// GET /api/credit-notes/:id/html
router.get('/:id/html', creditNoteController.getCreditNoteHtml);

// GET /api/credit-notes/:id/pdf-url
router.get('/:id/pdf-url', creditNoteController.getCreditNotePdfUrl);

module.exports = router;

