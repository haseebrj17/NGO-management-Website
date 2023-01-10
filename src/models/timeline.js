const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
    name: {
        type: String,
        min: 3,
        required: true,
        max: 255,
        index: true
    },
    time: {
        type: Date,
        required: true,
    },
    discription: {
        type: String,
        min: 6,
        required: true,
        max: 2048
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const Timeline = mongoose.model("Timeline", timelineSchema);

module.exports = Timeline;