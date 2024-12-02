import { WebClient } from '@slack/web-api';
import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import nodemailer from 'nodemailer';
import * as path from 'path';
dotenv.config();

const botToken = process.env['BOT_TOKEN'] || '';

const channelId = '#' + process.env['CHANNEL_ID'] || '';

const aiurl: string = process.env['AI_URL'] || '';
const apikey: string = process.env['API_KEY'] || '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'] || '',
    pass: process.env['EMAIL_PASSKEY'] || '',
  },
});

export const nlp = async (events: any[]) => {
  for (let event of events) {
    let description: string = event.description;
    let userEmail: string = event.userEmail;
    let userId: string = event.id;

    const prompt: string = `
    Given the description of a tag or a complaint from the users, identify the following:

    1. Team: The team that would most likely be as sociated with this tag based on the description. There are three teams: 
       - Payment Gateway Team
       - Authentication Team
       -UI Team
    2. Priority: Based on sentiment analysis, determine the priority level (e.g., high, medium, low).

    Description: "${description}"

    Please return the result in this format:
    1. Team: [team name]
    2. Priority: [priority level]

    No need for any explanation.
    `;

    try {
      const response = await axios.post(
        aiurl,
        {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: 'mixtral-8x7b-32768',
          max_tokens: 50,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apikey}`,
          },
        }
      );

      const prompt_response = response?.data?.choices[0]?.message?.content?.trim();

      if (prompt_response) {
        console.log('Response from AI: ', prompt_response);
        let [team, priority] = parseResponse(prompt_response);
        const tag=teamToTag(team)
        await sendApprovalMessage(channelId, team, priority, description, userId, tag);
        const emailResponse = await sendEmailNotification(userEmail, team, priority);
        console.log(emailResponse);

        if (emailResponse === 'Success') {
          removeBugReportByUserId(userId);
        } else {
          console.log('email notificatin failed');
        }

        console.log(`Extracted Team: ${team}, Extracted Priority: ${priority}`);
      } else {
        console.log('No response content found.');
      }
    } catch (error) {
      console.error('Error during API call:', error);
    }
  }
};

function parseResponse(responseText: string): [string, string] {
  const teamMatch = responseText.match(/Team:\s*(.*)/i);
  const priorityMatch = responseText.match(/Priority:\s*(.*)/i);

  const team = teamMatch ? teamMatch[1] : 'Unknown Team';
  const priority = priorityMatch ? priorityMatch[1] : 'Unknown Priority';

  return [team, priority];
}

async function sendApprovalMessage(channelId: string, team: string, priority: string, description: string, id: string, tag:string) {
  const client = new WebClient(botToken);

  try {
    const eventDetails = `Team: ${team}\nPriority: ${priority}`;

    await client.chat.postMessage({
      channel: channelId,
      text: 'A new event requires your approval:',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Description : ${description}\n userId : ${id}\nDetected Tag:${tag}\n${team} has been notified for the same \n This tag has been given ${priority} priority as detected by our model`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve',
              },
              value: JSON.stringify({ team, priority, action: 'approve' }),
              action_id: 'approve_event',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Reject',
              },
              value: JSON.stringify({ team, priority, action: 'reject' }),
              action_id: 'reject_event',
            },
          ],
        },
      ],
    });

    console.log('Message with buttons posted to channel:', channelId);
  } catch (error) {
    console.error('Error sending message with buttons:', error);
  }
}

function sendEmailNotification(userEmail: string, team: string, priority: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from: 'shettysnehal105@gmail.com',
      to: userEmail,
      subject: `Your Event Notification: ${team} Team Notified`,
      text: `Hello,\n\nYour event has been successfully filed.\nThe team "${team}" has been notified, and the priority has been set to "${priority}".\n\nBest regards,\nDevRev Team`,
    };

    transporter.sendMail(mailOptions, (error: Error | null, info: any) => {
      if (error) {
        console.error('Error sending email:', error);
        reject('Failure');
      } else {
        console.log('Email sent: ' + info.response);
        resolve('Success');
      }
    });
  });
}

const removeBugReportByUserId = (userId: string) => {
  try {
    const filePath = path.resolve(__dirname, '../../fixtures/on_bug_report_event.json');

    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const bugReports = JSON.parse(jsonData);

    const index = bugReports.findIndex((report: { id: string }) => report.id === userId);

    if (index !== -1) {
      bugReports.splice(index, 1);

      fs.writeFileSync(filePath, JSON.stringify(bugReports, null, 2), 'utf-8');

      console.log(`Bug report for userId ${userId} has been removed successfully.`);
    } else {
      console.log(`No bug report found for userId ${userId}.`);
    }
  } catch (error) {
    console.error('An error occurred while removing the bug report:', error);
  }
};

const teamToTag = (team: string): string => {
  // Replace "Team" with "Tag" for the given team name
  return team.replace(" Team", " Tag");
};

