const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
    _id: { type: String },
    encryptedSecret: { type: String, required: true },
    iv: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

shareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Sharesecret', shareSchema);
