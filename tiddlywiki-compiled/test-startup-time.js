//const args = ['node_modules/tiddlywiki/editions/full'];
console.log(process.memoryUsage())

require('rxjs/bundles/Rx.min.js')

const NS_PER_SEC = 1000000000;

// editions/full
// 40 full 1.56736974415 0.013585980406410259 0.5434392162564103
// 40 comp 0.8400504504999998 -0.0006411503717948686 -0.025646014871794742
// 40 full-old 1.6838958261249999 -0.000771474028846153 -0.03085896115384612
// 40 comp-old 0.8662105797 0.0028884164692307675 0.1155366587692307

// editions/empty
// | 160 | 'full'     | 0.8848998899937501 | -0.0002094977672562906 -0.033519642761006496
// | 160 | 'comp'     | 0.6129487712500007 | -0.000593133668238998 -0.09490138691823968
// | 160 | 'full-old' | 0.9584500439124997 | 0.0004953379942610088 0.07925407908176141
// | 160 | 'comp-old' | 0.6386704537312501 | -0.00011597669013364842 -0.018556270421383747
const edition = 'node_modules/tiddlywiki/editions/empty';
var tests = [
	["full", "./node_modules/tiddlywiki/boot/boot", edition],
	["comp", "./compiled/tiddlywiki/boot/boot", edition],
	['full-old', "./node_modules/tiddlywiki/boot/boot-old", edition],
	["comp-old", "./compiled/tiddlywiki/boot/boot-old", edition]
]
var count = 0;
var times = {}
var max = {}
var min = {}
tests.forEach(e => times[e[0]] = max[e[0]] = min[e[0]] = 0);
function doTest(index) {
	if(index === 0) count++;
	return new Promise(resolve => {
		//console.time(tests[index][0])
		const start = process.hrtime();
		const $tw = require(tests[index][1]).TiddlyWiki();
		$tw.boot.argv = [tests[index][2]];
		$tw.boot.boot(() => {
			const time = process.hrtime(start);
			const time2 = (time[0] + (time[1] / NS_PER_SEC)) - times[tests[index][0]];
			times[tests[index][0]] += time2 / count;

			if(min[tests[index][0]] > time2) min[tests[index][0]] = time2
			if(max[tests[index][0]] < time2) max[tests[index][0]] = time2

			console.log(count, tests[index][0], times[tests[index][0]], min[tests[index][0]], max[tests[index][0]])

			resolve();
		});
		
	})
}

function run(index){
	//console.log(index);
	doTest(index).then(() => {
		run((index + 1) % tests.length);
	})
}
run(0);

console.log(process.memoryUsage());
console.log();
//console.log(walkChildren(module.children))

// if (process.argv[2] === 'comp') {

// }

function walkChildren(children) {
	const res = {}
	children.forEach(e => {
		res[e.id] = walkChildren(e.children);
	})
	return res;
}
