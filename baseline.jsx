// baseline.jsx
// Basic ExtendScript for Adobe Premiere Pro.
// Prompts the user to select a folder with two video files and one MP3 playlist.
// Imports the files and creates a new sequence as a starting point.

(function () {
    var project = app.project;

    // Select folder containing workout assets
    var inputFolder = Folder.selectDialog("Select workout folder");
    if (!inputFolder) {
        alert("No folder selected. Script cancelled.");
        return;
    }

    var filesToImport = [];
    var file1 = File(inputFolder.fsName + "/video1.mp4");
    var file2 = File(inputFolder.fsName + "/video2.mp4");
    var playlist = File(inputFolder.fsName + "/playlist.mp3");

    if (file1.exists) { filesToImport.push(file1.fsName); }
    if (file2.exists) { filesToImport.push(file2.fsName); }
    if (playlist.exists) { filesToImport.push(playlist.fsName); }

    if (filesToImport.length === 0) {
        alert("No expected files found in folder.");
        return;
    }

    project.importFiles(filesToImport, false, project.rootItem, false);

    // Reference imported items
    var items = [];
    for (var i = 0; i < project.rootItem.children.numItems; i++) {
        items.push(project.rootItem.children[i]);
    }

    // Create sequence using first video as template
    if (items.length > 0) {
        var seqName = "Workout Sequence";
        var seq = project.createNewSequenceFromClips(seqName, [items[0]], project.rootItem);
        if (seq) {
            if (items.length > 1) {
                seq.videoTracks[0].overwriteClip(items[1], seq.videoTracks[0].end);
            }
            if (items.length > 2) {
                seq.audioTracks[0].overwriteClip(items[2], 0);
            }
        } else {
            alert("Failed to create sequence.");
        }
    } else {
        alert("No items imported.");
    }
})();
