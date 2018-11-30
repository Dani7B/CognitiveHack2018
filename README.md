# CognitiveHack2018
### CognitiveHack Rome 2018 - Challenge "IT Infrastructure Cognitive Monitoring"

## References
GitHub: https://github.com/mczei/CognitiveHack2018
Online event server base url: http://169.62.240.202:3000
	- /events: return number of events available
	- /events/{id}: return the event for the given position (from 0 to number of events)


## Included folders:
- Data: 3 datasets to train, test and evaluate the system
- EventServer: NodeJS server processing and posting events
- APIMock: NodeJS mock server to test receiving events

## Datasets:
- Training.zip: Dataset containing both the event and, when occurred, the opened ticket.
- Test.zip: Same dataset as Training.zip but always without the ticket
- Evaluate.zip: A new dataset always without the ticket

## Data definition
All datasets are a JSON array of the following event objects
`{`
`	"MessageId": The message id provided by environment`
`	"IdTT": The ticket created by the user, when applicable (only in the training dataset. Other dataset always empty string)`
`	"Severity": The severity assigned`
`	"Dup": Duplication advisor`
`	"TimeRecived": Timestamp when event was created`
`	"TimeAcknowledge": Timestamp when event was acknowledged`
`	"UserAcknowledge": Acknowledging user`
`	"Node": Node sending the message`
`	"TimeActionOwn": Timestamp when action took place`
`	"UserActionOwn": User in charge of action`
`	"TimeActionAck": N/A (always null)`
`	"Application": Application sending the message`
`	"MsgGroup": Message group`
`	"Object": Lookup path for detailed info`
`	"MessageText": Event details`

`}`


## How to use EventServer without custom configurations
 - Requires: 
   - NodesJS >=8.11.2
   - npm >=6.2.0
 - Optional: 
   - yarn >=1.7.0
 - Clone the repo from GitHum
 - Fetch node modules from inside the EventServer folder (i.e. yarn install)
 - Create a folder named "Repository" at the same level of the EventServer
 - Copy into the "Repository" folder any dataset of your choice and rename it "result.json"
 - Start server from inside the EventServer folder (i.e. yarn start) and wait until dataset is loaded
 - Use following endpoints form a browser or any http client of your choice
   - http://localhost:3000 --> Check API if server is running
   - http://localhost:3000/diagnostic --> Check used resources
   - http://localhost:3000/events --> Get number of events available
   - http://localhost:3000/events/{id} --> Get the event at the given position in the dataset (from 0 to number of events - 1). Used for polling data
   - http://localhost:3000/timelapseFactor --> Check current time lapse factor
   - http://localhost:3000/cron/start --> Start POST-ing events like a time-machine to "http://localhost:3001/events". WARNING: Depending on your HW, it should crash randomly during the run due to network error
   - http://localhost:3000/cron/stop --> Stop POST-ing events
   - http://localhost:3000/cron/pause --> Pause POST-ing events
   - http://localhost:3000/cron/resume --> Resume POST-ing events, after being paused
   - http://localhost:3000/cron/start/{timelapseFactor}/{date} --> Start POST-ing events with the given time lapse factor and starting from the given date. Do not use timelapseFactor higher then 5000. Provide the date as ISO (yyyy-MMM-dd)


## How to use APIMock without custom configurations
 - Requires: 
   - NodesJS >=8.11.2
   - npm >=6.2.0
 - Optional: 
   - yarn >=1.7.0
 - Clone the repo from GitHum
 - Fetch node modules from inside the APIMock folder (i.e. yarn install)
 - Start server from inside the APIMock folder (i.e. yarn start) and wait until dataset is loaded. The API Mock server will listen on 3001 port and log to std output the received events
