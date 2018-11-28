const isDebugMode = false;
const listeningPort = 3000;
const listeningIpMask = "0.0.0.0";

const apiOnHTTPS = false;
const apiHost = "localhost";
const apiPort = 3001;
const apiPath = "/events";

const timeLapseFactor = 100;

module.exports = {
	isDebugMode : isDebugMode,
	listeningPort : listeningPort,
	listeningIpMask : listeningIpMask,
	apiOnHTTPS : apiOnHTTPS,
	apiHost : apiHost,
	apiPort : apiPort,
	apiPath : apiPath,
	timeLapseFactor : timeLapseFactor
}