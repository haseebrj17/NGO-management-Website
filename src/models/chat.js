const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    username: {
        type: String,
        min: 6,
        required: true,
        max: 255
    },
    message: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const Chat = mongoose.model("Chat", chatSchema);

module.exports = Chat;