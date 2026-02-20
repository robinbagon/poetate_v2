const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const shareLinkSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4 }, 
  mode: { type: String, enum: ['readonly', 'editable'], required: true }
}, { _id: false });

const poemSchema = new mongoose.Schema({
  content: { type: String, required: true },
  title: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  collaborators: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    mode: { type: String, enum: ['readonly', 'editable'], default: 'readonly' }
  }], 
  dateCreated: { type: Date, default: Date.now },
  shareLinks: [shareLinkSchema]
});

module.exports = mongoose.model('Poem', poemSchema);