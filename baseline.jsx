// baseline.jsx
// Basic ExtendScript for Adobe Premiere Pro.
// Prompts the user to select a workout folder containing two MP4 files and an MP3 playlist.
// The script imports these assets, creates a sequence, appends the second video, adds the playlist audio, and exports via Adobe Media Encoder.

(function () {
    var project = app.project;

    // Select folder containing workout assets
    var inputFolder = Folder.selectDialog("Select workout folder");
    if (!inputFolder) {
        alert("No folder selected. Script cancelled.");
        return;
    }

    // Collect two MP4 files and an MP3 file
    var videoFiles = inputFolder.getFiles("*.mp4");
    var audioFiles = inputFolder.getFiles("*.mp3");
    if (videoFiles.length < 2 || audioFiles.length === 0) {
        alert("Folder must contain at least two MP4 files and one MP3 file.");
        return;
    }

    var filesToImport = [videoFiles[0].fsName, videoFiles[1].fsName, audioFiles[0].fsName];

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
        if (!seq) {
            alert("Failed to create sequence.");
            return;
        }

        // Append second video and add playlist audio
        if (items.length > 1) {
            seq.videoTracks[0].overwriteClip(items[1], seq.videoTracks[0].end);
        }
        if (items.length > 2) {
            seq.audioTracks[0].overwriteClip(items[2], 0);
        }

        // Export via Adobe Media Encoder
        var outputFolder = Folder.selectDialog("Select output folder");
        if (!outputFolder) {
            alert("No output folder selected.");
            return;
        }
        var outputPath = outputFolder.fsName + "/" + inputFolder.name + "_final.mp4";
        var presetFile = File.openDialog("Select AME preset (.epr)");
        if (!presetFile) {
            alert("No preset selected.");
            return;
        }

        app.encoder.launchEncoder();
        var jobID = app.encoder.encodeSequence(seq, outputPath, presetFile.fsName, app.encoder.ENCODE_WORKAREA);
        if (jobID === 0) {
            alert("Failed to start encode job.");
        } else {
            alert("Encoding started: " + outputPath);
        }
    } else {
        alert("No items imported.");
    }
})();
