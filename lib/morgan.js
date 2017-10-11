const morgan = require('./morgan-lib');
const stream = require('stream');
//const { Writable } = require('stream');

const myWritable = new stream.Writable({
	write: function (chunk, encoding, callback) {
		if (Buffer.isBuffer(chunk)) {
			chunk = chunk.toString('utf8');
		}
		if (chunk.endsWith("\n")) chunk = chunk.slice(0, chunk.length - 1);
		if (chunk.endsWith("\r")) chunk = chunk.slice(0, chunk.length - 1);
		console.log(chunk);
		callback && callback();
	}
});
(function () {
	var pad = 60;
	morgan.token('padurl', function getUrlToken(req) {
		var url = req.originalUrl || req.url;
		if (url.length < pad) {
			url += new Array(pad - url.length).join(' ');
		}
		return url;
	})
})();
(function () {
	var pad = 8;
	morgan.token('padmethod', function getUrlToken(req) {
		var method = req.method;
		if (method.length < pad) {
			method += new Array(pad - method.length).join(' ');
		}
		return method;
	})
})();


var colors;
(function (colors) {
    colors.Reset = "\x1b[0m";
    colors.Bright = "\x1b[1m";
    colors.Dim = "\x1b[2m";
    colors.Underscore = "\x1b[4m";
    colors.Blink = "\x1b[5m";
    colors.Reverse = "\x1b[7m";
    colors.Hidden = "\x1b[8m";
    colors.FgBlack = "\x1b[30m";
    colors.FgRed = "\x1b[31m";
    colors.FgGreen = "\x1b[32m";
    colors.FgYellow = "\x1b[33m";
    colors.FgBlue = "\x1b[34m";
    colors.FgMagenta = "\x1b[35m";
    colors.FgCyan = "\x1b[36m";
    colors.FgWhite = "\x1b[37m";
    colors.BgBlack = "\x1b[40m";
    colors.BgRed = "\x1b[41m";
    colors.BgGreen = "\x1b[42m";
    colors.BgYellow = "\x1b[43m";
    colors.BgBlue = "\x1b[44m";
    colors.BgMagenta = "\x1b[45m";
    colors.BgCyan = "\x1b[46m";
    colors.BgWhite = "\x1b[47m";
})(colors = {});

var clfmonth = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]
function pad2(num) {
	var str = String(num)

	return (str.length === 1 ? '0' : '')
		+ str
}

function getLocalDate(format, date, tzo, colorDivider) {
	const color = colors.FgYellow;

	switch (format || 'web') {
		case 'clf':
			return color + pad2(date.getDate()) +
				'/' + clfmonth[date.getMonth()] +
				'/' + date.getFullYear() +
				':' + pad2(date.getHours()) +
				':' + pad2(date.getMinutes()) +
				':' + pad2(date.getSeconds()) +
				' ' + tzo + colors.Reset;
		case 'iso':
			return color + date.getFullYear() +
				'-' + pad2(date.getMonth() + 1) +
				'-' + pad2(date.getDate()) +
				(colorDivider ? '\x1b[31mT' + color : 'T') + pad2(date.getHours()) +
				':' + pad2(date.getMinutes()) +
				':' + pad2(date.getSeconds()) +
				'.' + (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5) +
				tzo + colors.Reset;
		case 'web':
			return date.toUTCString()
	}
}


exports.getLocalDate = getLocalDate;

morgan.token('localdate', function getDateToken(req, res, format) {
	var dt = new Date()
	var tzo = (dt.getTimezoneOffset() / 60);
	tzo = (tzo < 0 ? '+' : '-') + pad2(tzo.toFixed(0)) + tzo.toFixed(2).split('.')[1];
	return getLocalDate(format, dt, tzo, true);
});

morgan.token('local-addr', (req, res) => {
	const addr = req.connection.localAddress;
	return addr ? addr + new Array((15 - addr.length) + 1).join(' ') : '               ';
})

morgan.format('mydevcolor', function developmentFormatLine(tokens, req, res) {
	// get the status code if response written
	var status = res.headersSent ? res.statusCode : 0

	var path = req.url.split('/');
	var col = path[1] === 'col' || path[1] === 'query';
	var page = ['patient', 'protocol', 'product'].indexOf(path[1]) > -1;
	// get status color
	var color = status >= 500 ? 31 // red
		: status >= 400 ? 33 // yellow
			: status >= 300 ? 36 // cyan
				: status >= 200 ? 32 // green
					: 0 // no color

	path = page ? 2 : col ? 1 : 0;
	var colorkey = [path, color].join('-');
	// get colored function
	var fn = developmentFormatLine[colorkey]

	if (!fn) {
		var colorcode = '\x1b[' + color + 'm';
		var colorzero = '\x1b[0m';
		if (status >= 400 && path > 0) colorzero = colorcode;
		else if (path == 1) colorcode = colorzero = '\x1b[32m';
		else if (path == 2) colorcode = colorzero = '\x1b[36m';
		// compile
		fn = developmentFormatLine[colorkey] = morgan.compile(
			'[:localdate[iso]]' + colorzero + ' :padmethod :local-addr ' + colorcode + ':status \x1b[35m:remote-addr ' + colorzero + ':padurl :response-time ms - :res[content-length]\x1b[0m'
		)
	}

	return fn(tokens, req, res)
})


morgan.format('mydev', '[:localdate[iso]] :method :status  :remote-addr :padurl :response-time ms - :res[content-length]\x1b[0m')



exports.handler = morgan('mydevcolor', {
	skip: function (req, res) {
		return !!req.skipLog;
	},
	stream: myWritable
});