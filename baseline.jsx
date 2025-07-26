// baseline.jsx
// Basic ExtendScript for Adobe Premiere Pro.
// Prompts the user to select a root workout folder. This folder may live directly
// under the month directory or within "00_Footage". Inside it should contain an
// MP3 playlist and a subfolder (named after the root folder) that holds two
// MOV/MP4 files. Imported clips are placed in a bin named after the workout
// folder itself. The script identifies the workout modality from the root folder name
// (Signature, Cardio, Strength, or Flow). It looks in the project's "Sequences" bin for a sequence named "MASTER_b3_<Modality>_Template".
// These templates are regular sequences that Premiere treats like any other. The matching template sequence is duplicated and renamed to the workout name.
// After duplicating and renaming the template sequence the script stops so you
// can manually create a multi‑camera sequence. No export or encode job is
// launched automatically.

(function () {
    var project = app.project;

    // Select workout root folder
    var rootFolder = Folder.selectDialog("Select workout root folder");
    if (!rootFolder) {
        alert("No folder selected. Script cancelled.");
        return;
    }

    // Determine workout modality from folder name
    var modalities = ['Signature', 'Cardio', 'Strength', 'Flow'];
    var modality = null;
    for (var m = 0; m < modalities.length; m++) {
        if (rootFolder.name.toLowerCase().indexOf(modalities[m].toLowerCase()) !== -1) {
            modality = modalities[m];
            break;
        }
    }
    if (!modality) {
        alert('Could not determine workout type from folder name: ' + rootFolder.name);
        return;
    }



    // Gather files from the workout root. The playlist MP3 sits directly inside
    // the root folder and the two video files reside in a subfolder named after
    // the workout folder (or the first subfolder if not found).
    var audioFiles = rootFolder.getFiles('*.mp3');

    var videoFolder = new Folder(rootFolder.fullName + '/' + rootFolder.name);
    if (!videoFolder.exists) {
        var subfolders = rootFolder.getFiles(function (f) { return f instanceof Folder; });
        if (subfolders.length > 0) {
            videoFolder = subfolders[0];
        }
    }
    if (!videoFolder.exists) {
        alert('Missing video folder: ' + videoFolder.fsName);
        return;
    }
    var videoFiles = videoFolder.getFiles(function (f) {
        return f instanceof File && /\.(mov|mp4)$/i.test(f.name);
    });

    if (videoFiles.length < 2 || audioFiles.length === 0) {
        alert('Workout folder must include at least two video files and one MP3 playlist.');
        return;
    }

    var filesToImport = [videoFiles[0].fsName, videoFiles[1].fsName, audioFiles[0].fsName];

    // Locate or create a bin named after the workout folder and import there
    var footageBin = findBinByName(project.rootItem, rootFolder.name);
    if (!footageBin) {
        footageBin = project.rootItem.createBin(rootFolder.name);
    }

    // Keep track of existing items so we know which ones were imported
    var beforeImport = footageBin.children.numItems;

    project.importFiles(filesToImport, false, footageBin, false);

    // Reference only the newly imported items from the workout bin
    var items = [];
    for (var i = beforeImport; i < footageBin.children.numItems; i++) {
        items.push(footageBin.children[i]);
    }

    // Categorize imported items
    var videoItems = [];
    var audioItem = null;
    for (var j = 0; j < items.length; j++) {
        var itm = items[j];
        if (/\.(mov|mp4)$/i.test(itm.name)) {
            videoItems.push(itm);
        } else if (/\.mp3$/i.test(itm.name)) {
            audioItem = itm;
        }
    }


    // Normalize names to allow flexible matching
    function normalize(n) {
        return n.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, '');
    }

    // Utility to recursively locate a bin by (partial) name
    function findBinByName(item, name) {
        if (!item) {
            return null;
        }
        if (item.type === ProjectItemType.BIN) {
            if (normalize(item.name) === normalize(name) ||
                normalize(item.name).indexOf(normalize(name)) !== -1) {
                return item;
            }
            if (item.children && item.children.numItems > 0) {
                for (var i = 0; i < item.children.numItems; i++) {
                    var found = findBinByName(item.children[i], name);
                    if (found) {
                        return found;
                    }
                }
            }
        }
        return null;
    }

    // Utility to recursively locate a sequence item anywhere in the project
    function findSequenceItemByName(item, name) {
        if (!item) {
            return null;
        }
        if (item.type === ProjectItemType.SEQUENCE) {
            var n = normalize(item.name || '');
            if (n === normalize(name) || n.indexOf(normalize(name)) !== -1) {
                return item;
            }
        }
        if (item.type === ProjectItemType.BIN && item.children) {
            for (var i = 0; i < item.children.numItems; i++) {
                var found = findSequenceItemByName(item.children[i], name);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // Utility to recursively find a project item (sequence or clip) inside a bin
    function findItemInBin(bin, itemName) {
        if (!bin) {
            return null;
        }
        for (var i = 0; i < bin.children.numItems; i++) {
            var ch = bin.children[i];
            var childNameNorm = normalize(ch.name || '');
            if ((ch.type === ProjectItemType.SEQUENCE || ch.type === ProjectItemType.CLIP) &&
                (childNameNorm === normalize(itemName) ||
                 childNameNorm.indexOf(normalize(itemName)) !== -1)) {
                return ch;
            }
            if (ch.type === ProjectItemType.BIN) {
                var found = findItemInBin(ch, itemName);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    // Locate "Sequences" bin anywhere in the project (optional)
    var sequencesBin = findBinByName(project.rootItem, 'Sequences');

    var templateName = 'MASTER_b3_' + modality + '_Template';

    // Helper to search all sequences in the project
    function findSequenceByName(name) {
        for (var i = 0; i < project.sequences.numSequences; i++) {
            var seq = project.sequences[i];
            if (normalize(seq.name) === normalize(name) ||
                normalize(seq.name).indexOf(normalize(name)) !== -1) {
                return seq;
            }
        }
        return null;
    }

    // Search the entire project for a sequence matching the modality template
    var templateItem = findSequenceItemByName(project.rootItem, templateName);
    var templateSeq = null;
    if (templateItem && templateItem.getSequence) {
        templateSeq = templateItem.getSequence();
    } else if (templateItem && templateItem.sequence) {
        templateSeq = templateItem.sequence;
    }
    if (!templateSeq) {
        // Fallback to scanning app.project.sequences (open sequences)
        templateSeq = findSequenceByName(templateName);
    }
    if (!templateSeq) {
        var collected = [];
        for (var s = 0; s < project.sequences.numSequences; s++) {
            collected.push(project.sequences[s].name);
        }
        alert('No sequence template found named "' + templateName + '".\nAvailable sequences: ' + collected.join(', '));
        return;
    }

    // Duplicate the template sequence and rename it to match the workout
    var existingSeqs = {};
    for (var ei = 0; ei < project.sequences.numSequences; ei++) {
        existingSeqs[project.sequences[ei].name] = true;
    }

    if (templateItem && templateItem.clone) {
        templateItem.clone();
    } else {
        templateSeq.clone();
    }

    // Identify the newly created sequence (name not in the set prior to cloning)
    var seq = null;
    for (var ni = 0; ni < project.sequences.numSequences; ni++) {
        var candidate = project.sequences[ni];
        if (!existingSeqs[candidate.name]) {
            seq = candidate;
            break;
        }
    }

    if (!seq) {
        alert('Failed to duplicate sequence.');
        return;
    }

    // Rename both the sequence and its project item
    try { seq.name = rootFolder.name; } catch (e) {}
    if (seq.projectItem) {
        try { seq.projectItem.name = rootFolder.name; } catch (e) {}
    }

    app.project.activeSequence = seq;

    // Pause so the user can create the multi-camera sequence manually
    alert('Sequence duplicated and renamed to "' + rootFolder.name + '".\n' +
          'Create your multi-camera source sequence manually and continue editing.');

})();

