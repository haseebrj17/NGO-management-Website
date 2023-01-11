const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema({
    username: {
        type: String,
        min: 6,
        required: true,
        max: 255,
        index: true
    },
    task: {
        type: String,
        unique: true,
        required: true,
    },
    deadline: {
        type: Date,
        unique: false,
        required: true,
        index: true
    },
    done: {
        type: Boolean,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const Checklist = mongoose.model("Checklist", checkSchema);

module.exports = Checklist;