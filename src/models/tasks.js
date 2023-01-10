const mongoose = require('mongoose');

const tasksSchema = new mongoose.Schema({
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
    date: {
        type: Date,
        default: Date.now
    }
});

const Tasks = mongoose.model("Tasks", tasksSchema);

module.exports = Tasks;