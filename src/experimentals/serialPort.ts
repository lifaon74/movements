var SerialPort = require('virtual-serialport');

var sp = new SerialPort('COM3', { baudrate: 57600 }); // still works if NODE_ENV is set to development!

sp.on('open', function (err:any) {

  sp.on("data", function(data:any) {
    console.log("From Arduino: " + data);
  });

  sp.on("dataToDevice", function(data:any) {
    sp.writeToComputer(data + " " + data + "!");
  });

  setInterval(() => {
    sp.write("BLOOP"); // "From Arduino: BLOOP BLOOP!"
  }, 1000);

});