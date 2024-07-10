const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const { series, src, dest } = gulp;

// Custom clean function using fs and path
function clean(cb) {
    const directory = './public';

    // Check if directory exists
    if (fs.existsSync(directory)) {
        // Recursively remove directory
        removeDirectory(directory);
    }

    cb(); // Callback to indicate completion
}

// Recursive function to remove directory
function removeDirectory(directory) {
    fs.readdirSync(directory).forEach((file) => {
        const filePath = path.join(directory, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            removeDirectory(filePath);
        } else {
            fs.unlinkSync(filePath);
        }
    });
    fs.rmdirSync(directory);
}

// Example of other tasks
function defaultTask(cb) {
    src('app/*')
        .pipe(dest('public/'))
        .on('end', function() {
            src('app/trait-viz/lib/*')
                .pipe(dest('public/trait-viz/lib/'))
                .on('end', cb);
        });
}

// Register tasks
exports.clean = clean;
exports.default = defaultTask;
exports.build = series(clean, defaultTask);

