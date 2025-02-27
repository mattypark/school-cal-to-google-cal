import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "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",
});

const completion = openai.chat.completions.create({
  model: "gpt-4o-mini",
  store: true,
  messages: [
    {"role": "user", "content": "write a haiku about ai"},
  ],
});

completion.then((result) => console.log(result.choices[0].message));