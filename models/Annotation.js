const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  poemId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Poem' },
  annotationId: { type: String, required: true },
  text: { type: String, required: true },
  highlight: { type: String },
  wordIndices: [{ type: String }],
  timestamp: { type: Date, default: Date.now },
  relativePosition: {
    dx: Number,
    dy: Number
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
    //default: null // 🔹 allows anonymous annotations
  }
});

module.exports = mongoose.model('Annotation', annotationSchema);
