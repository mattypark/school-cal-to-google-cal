import OpenAI from "openai";

interface ExtractedEvent {
  summary: string;
  description?: string;
  location?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence?: string[];
}

export class AIService {
  private static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  static async extractEventsFromHTML(html: string): Promise<ExtractedEvent[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are a calendar event extraction expert. Extract events from HTML content.
            Return a JSON array of events with these fields:
            - summary (required): event title/name
            - description: additional details
            - location: where the event takes place
            - date: YYYY-MM-DD format
            - startTime: HH:mm 24-hour format
            - endTime: HH:mm 24-hour format
            - recurrence: array of recurrence rules (e.g. ["FREQ=WEEKLY;UNTIL=20240531"])`
          },
          {
            role: "user",
            content: `Extract calendar events from this HTML: ${html}`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content);
      return result.events || [];
    } catch (error) {
      console.error('AI extraction failed:', error);
      return [];
    }
  }

  static async enhanceEventDescription(event: ExtractedEvent): Promise<ExtractedEvent> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You enhance calendar event descriptions by adding relevant context and formatting."
          },
          {
            role: "user",
            content: `Enhance this calendar event with more context and better formatting:
            ${JSON.stringify(event, null, 2)}`
          }
        ],
        temperature: 0.7
      });

      const enhancedDescription = response.choices[0].message.content || "";
      const enhancedEvent = {
        ...event,
        description: enhancedDescription || event.description
      };

      return enhancedEvent;
    } catch (error) {
      console.error('Event enhancement failed:', error);
      return event;
    }
  }
}