const express = require('express');
const http = require('http');
const https = require('https');
const io = require('socket.io');
const cors = require('cors');
const fs = require('fs'); 

const app = express();
const httpServer = http.Server(app);
const webSocketServer = io(httpServer);

const settings = require('./settings.js');

var isDebugMode = settings.isDebugMode;
var listeningPort = settings.listeningPort;
var listeningIpMask = settings.listeningIpMask;
console.log('settings.apiOnHTTPS: ' + settings.apiOnHTTPS);

var apiOnHTTPS = settings.apiOnHTTPS;
var apiHost = settings.apiHost;
var apiPort = settings.apiPort;
var apiPath = settings.apiPath;
var timeLapseFactor = settings.timeLapseFactor;
	
//UTC JSON format, to deserialize JSON Repository at warmup
const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const eventRepositoryFile = "/../Repository/result.json";
const eventRepositoryPath =  __dirname + eventRepositoryFile;

var eventRepository;
var scheduler;
//-1: Error, 0: Initial, 1: Loading repository, 2: stopped, 3: running, 4: paused, 5: 5: completed
const errorStatus = -1;
const initialStatus = 0;
const loadingStatus = 1;
const stoppedStatus = 2;
const runningStatus = 3;
const pausedStatus = 4;
const completedStatus = 5;
var status = 0;
var lastIndex = 0;
var lastEndDateLocal = null;

var args = process.argv.slice(2);
var argv = require('minimist')(args, { boolean: [ 'debug' ] });
console.log('Parameters: ' + args);
console.log(argv);

if (argv.debug){
	console.log('Debug mode is ENABLED!');
	isDebugMode = true;
}

if (!(argv.port === undefined))
	listeningPort = argv.port;
if (!(argv.ipMask === undefined))
	listeningIpMask = argv.ipMask;
if (!(argv.apiHost === undefined))
	apiHost = argv.apiHost;
if (!(argv.apiPort === undefined))
	apiPort = argv.apiPort;
if (!(argv.apiPath === undefined))
	apiPath = argv.apiPath;
if (!(argv.timeLapseFactor === undefined))
	timeLapseFactor = argv.timeLapseFactor;


warmup();

app.use(express.json());

httpServer.listen(listeningPort, listeningIpMask, function(){
  console.log('HTTP Server listening on port ' + listeningPort.toString() + ' with IP mask set to ' + listeningIpMask)
  console.log('App Server listening on port ' + listeningPort.toString() + ' with IP mask set to ' + listeningIpMask)
  console.log('Current time lapse factor is: ' + timeLapseFactor + 'x');
});

app.get('/', cors(), (req, res) => {
    res.send("WebAPI server is running!")
} )


app.get('/diagnostic', cors(), (req, res) => {
	const used = process.memoryUsage();
	var result = new Map();
	
	for(let k in used){
		let v = used[k];
		let kb = Math.round(v / 1024);
		let mb = Math.round(v / 1024 / 1024 * 100) / 100;
		result.set(k, { bytes: v, KB: kb, MB: mb } );
	}	

    res.send([...result]);
} )

app.get('/dashboard', function(req, res) {
	if (isDebugMode)
		console.log('Dashboard request');
	res.sendFile(__dirname + '/index.html');
});

app.get('/status', cors(), (req,res) => {
	if (isDebugMode)
		console.log('get current server status')
    res.send({ status: status })
} )

app.get('/timelapseFactor', cors(), (req,res) => {
	if (isDebugMode)
		console.log('get current server timelapse factor')
    res.send({ timelapseFactor: timeLapseFactor })
} )

app.get('/events', cors(), (req,res) => {
	if (testRepositoryLoaded(res)){
		if (isDebugMode)
			console.log('get loaded events');
				
		//Since cannor return all events, just provide total count :-)
		console.log('Repository size: ' + eventRepository.length);
		res.send({ size: eventRepository.length });
	}
} )

app.get('/events/:id', cors(), (req,res) => {
	if (testRepositoryLoaded(res)){
		if (isDebugMode){
			console.log('get one single event');
			console.log('Repository size: ' + eventRepository.length);
		}
		console.log('ID: ' + req.params.id);
		
		if ( (req.params.id >= 0) && (req.params.id < eventRepository.length) )
			res.send( eventRepository[req.params.id] );
		else 
			res.sendStatus(404);
	}
} )

app.get('/cron/start', cors(), (req,res) => {
	if (testRepositoryLoadedAndIdle(res)){
		if (isDebugMode)
			console.log('Start');
		
		startScheduler(0, null, 0);
		res.sendStatus( 202 );
	}
} )

app.get('/cron/start/:date', cors(), (req,res) => {
	if (testRepositoryLoadedAndIdle(res)){
		startRequestHelper(res, req.params.date, null, timeLapseFactor)
		res.sendStatus( 202 );		
	}
} )

app.get('/cron/start/:timelapseFactor/:date', cors(), (req,res) => {
	if (testRepositoryLoadedAndIdle(res)){
		startRequestHelper(res, req.params.date, null, req.params.timelapseFactor)
		res.sendStatus( 202 );		
	}
} )

app.get('/cron/start/:timelapseFactor/:fromDate/:toDate', cors(), (req,res) => {
	if (testRepositoryLoadedAndIdle(res)){
		startRequestHelper(res, req.params.fromDate, req.params.toDate, req.params.timelapseFactor)
		res.sendStatus( 202 );		
	}
} )

app.post('/cron/start/', cors(), (req,res) => {
	if (testRepositoryLoadedAndIdle(res)){
		startRequestHelper(res, req.body.fromDate, req.body.toDate, timeLapseFactor)
		res.sendStatus( 202 );		
	}
} )

function validateDateInterval(res, startDateISOStr, endDateISOStr){
	if (isNaN(Date.parse(startDateISOStr))){
		res.status(400);
		res.send('Invalid start date format');
		return false;
	}
	
	if (endDateISOStr)
		if (isNaN(Date.parse(endDateISOStr))){
			res.status(400);
			res.send('Invalid end date format');
			return false;
		}
		
	return true;	
}

function startRequestHelper(res, startDateISOStr, endDateISOStr, tlFactor){
	
	if (isDebugMode)
		console.log('Start by timelapse factor and date');
	
	var testTlFactor = parseFloat(tlFactor);
	if (isNaN(testTlFactor)){
		res.status(400);
		res.send('Invalid timelapse factor');
	}
	else{
		timeLapseFactor = testTlFactor;
		if (isDebugMode)
			console.log('New time lapse factor is: ' + timeLapseFactor + 'x');
		
		if (validateDateInterval(res, startDateISOStr, endDateISOStr)) {
			var searchDateLocal = new Date(startDateISOStr);
			var searchDate = new Date(searchDateLocal.getTime() + searchDateLocal.getTimezoneOffset() * 60000);
			var endDateLocal = null;
			var endDate = null;
			if (endDateISOStr){
				endDateLocal = new Date(endDateISOStr);
				endDate = new Date(endDateLocal.getTime() + endDateLocal.getTimezoneOffset() * 60000);
			}
			
			if (isDebugMode)
				console.log('Parsed date is: ' + searchDate);

			if (isDebugMode)
				console.log('Begin index lookup');
			var index = eventRepository.findIndex((event) => {return event.TimeRecived >= searchDate});
			if (isDebugMode){
				console.log('Index lookup compled!');
				console.log('Index is: ' + index);
			}			
			if (index < 0)
				index = 0

			startScheduler(index, endDate, 0);
		}
	}

}

app.get('/cron/stop', cors(), (req,res) => {
	if (testRepositoryLoadedAndRunningOrIdle(res)){
		if (isDebugMode)
			console.log('Stop');
		stopScheduler(true);
		res.sendStatus( 202 );
	}
} )

app.get('/cron/pause', cors(), (req,res) => {
	if (testRepositoryLoadedAndRunning(res)){
		if (isDebugMode)
			console.log('Pause');
		pauseScheduler();
		res.sendStatus( 202 );
	}
} )

app.get('/cron/resume', cors(), (req,res) => {
	if (testRepositoryLoadedAndPaused(res)){
		if (isDebugMode)
			console.log('Resume at: ' + lastIndex);
		
		startScheduler(lastIndex, lastEndDateLocal, 0);
		res.sendStatus( 202 );
	}
} )

webSocketServer.of('/feed').on('connection', function(socket){
	if (isDebugMode)
		console.log('A new WebSocket connection has been established on item feeds');
});

webSocketServer.of('/status').on('connection', function(socket){
	if (isDebugMode)
		console.log('A new WebSocket connection has been established on status updates');
});

function testRepositoryLoadedAndPaused(res) {
	if (status == pausedStatus)
		return true;
	
	if (isDebugMode)
		console.log('Not in pause statust');
	res.status(500);
	res.send('Invalid system status');
	return false;				
}

function testRepositoryLoadedAndIdle(res) {
	if ( (status == stoppedStatus) || (status == pausedStatus) || (status == completedStatus) )
		return true;
	
	if (isDebugMode)
		console.log('Events not loaded yet or already running');
	res.status(500);
	res.send('Invalid system status');
	return false;				
}

function testRepositoryLoadedAndRunningOrIdle(res) {
	if ( (status == runningStatus) || (status == pausedStatus) )
		return true;

	
	if (isDebugMode)
		console.log('Events not loaded yet');
	res.status(500);
	res.send('Invalid system status');
	return false;				
}

function testRepositoryLoadedAndRunning(res) {
	if (status == runningStatus)
		return true;

	
	if (isDebugMode)
		console.log('Events not loaded yet');
	res.status(500);
	res.send('Invalid system status');
	return false;				
}

function testRepositoryLoaded(res) {
	if ((status == stoppedStatus) || (status == runningStatus)  || (status == pausedStatus) || (status == completedStatus))
		return true;

	
	if (isDebugMode)
		console.log('Events not loaded yet');
	res.status(500);
	res.send('Invalid system status');
	return false;				
}

function stopScheduler(emitUpdateStatus){
	if (scheduler){
		clearTimeout(scheduler);
		scheduler = null;
	}
	if(emitUpdateStatus)
		updateStatus(stoppedStatus );
}

function pauseScheduler(){
	if (scheduler){
		clearTimeout(scheduler);
		scheduler = null;
	}
	updateStatus(pausedStatus);
}

function processItem(repositoryIndex) {
	if (isDebugMode)
		console.log('Index: ' + (repositoryIndex));
	
	let obj = JSON.stringify(eventRepository[repositoryIndex]);
	console.log('MessageId: ' + (eventRepository[repositoryIndex].MessageId) + " @" + (eventRepository[repositoryIndex].TimeRecived) );
	if (isDebugMode)
		console.log(obj);
	
	let serverConnection = (apiOnHTTPS ? https : http);		

	var agent = new serverConnection.Agent({
		keepAlive: true,
		maxSockets: 1024
	});
	
	var options = {
	  hostname: apiHost,
	  port: apiPort,
	  path: apiPath,
	  method: 'POST',
	  agent: agent,
	  headers: { 
		'content-type': 'application/json',
		'Connection': 'Keep-Alive',
		'Content-Length': obj.length
	  },
	  body: obj
	};
	
		
	var req = serverConnection.request(options, (res) => {

		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			if ( (res.statusCode == 200) || (res.statusCode == 202) )
				console.log('statusCode:' + res.statusCode + ' for ID: ' + JSON.parse(chunk).id);
			else{
				console.log('statusCode:' + res.statusCode);
				console.log(chunk);
				stopScheduler(true);
			}
		});
		
	});

	req.on('error', (e) => {
		console.error(e);
		stopScheduler(true);
	});
	
	req.write(obj);
	req.end();
	lastIndex = repositoryIndex;
}

function processItemLoop(repositoryIndex, endDate, ms) {
	
    return new Promise((resolve, reject) => {
		if (repositoryIndex >= eventRepository.length)
			reject('Index overflow');
		else{
			scheduler = setTimeout(() => {
				let count = 0;
				let lastEvent;
				console.log('Processing timestamp: ' + eventRepository[repositoryIndex].TimeRecived);
				
				lastEvent = eventRepository[repositoryIndex].TimeRecived;
				var searchDate = new Date(lastEvent.getTime() - lastEvent.getTimezoneOffset() * 60000);
				
				console.log("****************************");
				console.log("lastEvent: " + lastEvent + "(" + lastEvent.getTime() + ")");
				console.log("searchDate: " + searchDate + "(" + searchDate.getTime() + ")");
				if(endDate)
					console.log("endDate: " + endDate + "(" + endDate.getTime() + ")");
				console.log("****************************");

				if(endDate){
					if (lastEvent.getTime() >= endDate.getTime()){
						resolve({count: count, ms: 0, shallContinue: false});
						return;
					}
				}

				webSocketServer.volatile.emit('processingTimestampChannel', searchDate);
				
				processItem(repositoryIndex);
				count++;
								
				if (repositoryIndex + count >= eventRepository.length){
					resolve({count: count, ms: 0, shallContinue: false});
					return;
				}
				
				let nextEvent = eventRepository[repositoryIndex + count].TimeRecived;
				while ( nextEvent.getTime() == lastEvent.getTime() ){
					processItem(repositoryIndex + count);
					
					if (repositoryIndex + count >= eventRepository.length){
						resolve({count: count, ms: 0, shallContinue: false});
						return;
					}
					
					lastEvent = eventRepository[repositoryIndex + count].TimeRecived;
					count++;
					nextEvent = eventRepository[repositoryIndex + count].TimeRecived;					
				}
									
				if(endDate){
					if (nextEvent.getTime() >= endDate.getTime()){
						resolve({count: count, ms: 0, shallContinue: false});
						return;
					}
				}
				
				let newMS = Math.abs(lastEvent.getTime() - nextEvent.getTime());
				resolve({count: count, ms: newMS, shallContinue: true});
			}, ms);
		}
    });
}

function startSchedulerInner(repositoryIndex, endDate, ms){
	processItemLoop(repositoryIndex, endDate, ms)
	.then((result) => {
		console.log('Processed items for this timestamp: ' + result.count);
		if (isDebugMode)
			console.log('Shall continue: ' + result.shallContinue);
		
		if (result.shallContinue){
			let effectiveNewMs = (result.ms / timeLapseFactor);
			console.log('Next event in (real): ' + result.ms + 'ms');
			console.log('Next event in (actual): ' + effectiveNewMs + 'ms');
			startSchedulerInner(repositoryIndex + result.count, endDate, effectiveNewMs);
		}
		else{
			if (isDebugMode)
				console.log('Last one');
			updateStatus(completedStatus);
			stopScheduler(false);
		}
	})
	.catch((err) => {
		console.log(err);
		updateStatus(errorStatus);
		stopScheduler(false);		
	});
}

function startScheduler(repositoryIndex, endDate, ms){
	
	if (scheduler == null){
		lastEndDateLocal = endDate;
		updateStatus(runningStatus);
		startSchedulerInner(repositoryIndex, endDate, ms);
	}
}

function updateStatus(statusCode){
	status = statusCode;
	webSocketServer.volatile.emit('newStatusCodeChannel', statusCode);
}

// wait ms milliseconds
function sleep(ms) {
	console.log('Start waintg for ' + ms + 'ms')
	
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

function loadFile(path) {
	updateStatus(loadingStatus);
	if (isDebugMode)
		console.log('Status: 1');
	
	return new Promise((resolve, reject) => {
		try {
			if (isDebugMode)
				console.log('Start parsing file: ' + path);
			setImmediate(() => { 
				resolve(JSON.parse(fs.readFileSync(eventRepositoryPath), reviver)) 
			});
		}
		catch (err) {
			reject(err);
		}
	});
}

function reviver(key, value) {

    if (typeof value === "string" && dateFormat.test(value)) {
        return new Date(value);
    }

    return value;
}

function warmup() {

	loadFile(eventRepositoryPath)
		.then((result) => {
			console.log('Building repository COMPLETED!');
			updateStatus(stoppedStatus);			
			eventRepository = result;
			if (isDebugMode)
				console.log('OK, Status: 2');
		})
		.catch((err) => {
			updateStatus(errorStatus);
			console.log('Something went wrong. Set status to -1')
			console.log(err);
		});
}