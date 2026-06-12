function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Run Script', 'generateKhutbahLink')
    .addToUi();
}

function onOpen2() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Run Script', 'extractKhutbahData')
    .addToUi();
}


function runMyFunction() {
  SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange('A1').setValue('Hello, world!');
}
