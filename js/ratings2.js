

var blob = new Blob([JSON.stringify(json)], {type: "text/plain;charset=utf-8"});
saveAs(blob, "sequence_dl.JSON");
