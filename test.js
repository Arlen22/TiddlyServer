const http = require('http');
http.get({
	protocol: 'http:',
	host: 'localhost',
	path: '/ArlenNotes/Arlen-NoteSelf.html',
	headers: {
		'Accept-Encoding': 'gzip'
	}
}, res => {
	var length = 0;
	res.on('data', chunk => { length += chunk.length; console.log(chunk.length) });
	res.on('end', () => { 
		let power = 0; 
		while (length >= 1024) { 
			length /= 1024; 
			power++; 
		}; 
		console.log('length %s %s', length.toFixed(2), ['B', 'KB', 'MB'][power]); 
	});
})