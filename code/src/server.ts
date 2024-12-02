import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3000;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const filePath = path.join(__dirname, 'fixtures', 'on_bug_report_event.json');

interface Event {
  id: string;
  description: string;
  userEmail: string;
  context: {
    secrets: {
      service_account_token: string;
    };
  };
  execution_metadata: {
    devrev_endpoint: string;
  };
}

app.post('/report-complaint', (req: Request, res: Response) => {
  const { userEmail, description } = req.body;
  console.log(userEmail, description);

  if (!userEmail || !description) {
    return res.status(400).json({
      error: 'Missing user email or description',
    });
  }

  const newEvent: Event = {
    id: `event${Date.now()}`,
    description: description,
    userEmail: userEmail,
    context: {
      secrets: {
        service_account_token: 'your-service-account-token',
      },
    },
    execution_metadata: {
      devrev_endpoint: 'https://api.devrev.ai',
    },
  };

  fs.readFile(filePath, 'utf8', (err, data) => {
    let events: Event[] = [];

    if (err) {
      if (err.code === 'ENOENT') {
        events = [];
      } else {
        return res.status(500).json({ error: 'Error reading the file' });
      }
    } else {
      events = JSON.parse(data);
      console.log('parsing done ', events);
    }

    events.push(newEvent);

    fs.writeFile(filePath, JSON.stringify(events, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error writing to the file', msg: err });
      }

      res.status(200).json({
        message: 'Complaint received and saved successfully!',
        newEvent,
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
