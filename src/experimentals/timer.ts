let NanoTimer = require('nanotimer');

let timer = new NanoTimer();

let count = 100000;
let a = 7;

let time = process.hrtime();
timer.setInterval(() => {
	// console.log('ok');
	count--;
	a = a * a / 18.4 * 49;
	if(count <= 0) {
		timer.clearInterval();
	}

}, [], '10u', function(err:any) {
	let diff = process.hrtime(time);
	
    if(err) {
        console.error(err);
    }
	console.log('end', diff[0] + diff[1] / 1e9);
});