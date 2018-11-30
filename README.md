# CognitiveHack2018
CognitiveHack Rome 2018 - Challenge "IT Infrastructure Cognitive Monitoring"

GitHub: https://github.com/mczei/CognitiveHack2018
Online event server base url: http://169.62.240.202:3000/
	- /events: return number of events available
	- /events/{id}: return the event for the given position (from 0 to number of events)


Included folders:
- Data: 3 datasets to train, test and evaluate the system
- EventServer: NodeJS server processing and posting events
- APIMock: NodeJS mock server to test receiving events

Datasets:
- Training.zip: Dataset containing both the event and, when occurred, the opened ticket.
- Test.zip: Same dataset as Training.zip but always without the ticket
- Evaluate.zip: A new dataset always without the ticket

All datasets are a JSON array of the following event objects
  {
    "MessageId": The message id provided by environment
    "IdTT": The ticket created by the user, when applicable (only in the training dataset. Other dataset always empty string)
    "Severity": The severity assigned
    "Dup": Duplication advisor
    "TimeRecived": Timestamp when event was created
    "TimeAcknowledge": Timestamp when event was acknowledged
    "UserAcknowledge": Acknowledging user
    "Node": Node sending the message
    "TimeActionOwn": Timestamp when action took place
    "UserActionOwn": User in charge of action 
    "TimeActionAck": N/A (always null)
    "Application": Application sending the message
    "MsgGroup": Message group
    "Object": Lookup path for detailed info
    "MessageText": Event details
  }

