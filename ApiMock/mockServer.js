const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();

//Overridable by command line arguments
var isDebugMode = false;
var listeningPort = 3001;
var listeningIpMask = "0.0.0.0";

const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

//Parse command line settings
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


app.use(express.json());
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded( { extended: true } ));

app.listen(listeningPort, listeningIpMask, function(){
  console.log('Server listening on port ' + listeningPort.toString() + ' with IP mask set to ' + listeningIpMask)
})


app.get('/', cors(), (req, res) => {
    res.send("Mock server is running!")
} )

app.post('/events', cors(), (req,res) => {
	if (isDebugMode)
		console.log('\nreceived new event:');
	else
		console.log('\n');
	console.log(req.body);

	res.send({id: req.body.MessageId});
} )

