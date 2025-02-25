# Challenge 4: Advanced RAG - "The Email Alchemist" 📧

## Introduction

Welcome to the most complex challenge yet! As "The Email Alchemist", you'll transform a simple RAG system into a sophisticated multi-step pipeline using LangChain. Your mission is to build an AI assistant that can:

1. Extract technical questions from customer call transcripts
2. Research answers using your knowledge base
3. Generate professional follow-up emails


## Step 0: Designing an email generation chain

This time, before diving into the codebase please take a step back and think about how you would design a multi-step pipeline for generating professional follow-up emails (based on the solution we implemented so far).

Assume that the starting point for each follow up email is a customer call transcript or your meeting notes. The goal of each follow up email should be to answer all questions that you were not able to answer during the meeting. It's crucial for your follow up answer to be deeply in factual knowlede and not hallucinate on technical details.

Consider the following aspects:

### Pipeline Components
1. **Transcript Analysis**
   - How will you extract technical questions from customer transcripts?
   - What key information needs to be identified? (e.g., customer pain points, specific technical issues)
   - How will you maintain the context of the conversation?

2. **Knowledge Base Research**
   - How will you formulate search queries from the extracted questions?
   - What strategy will you use to retrieve relevant information?
   - How will you handle multiple sources or potentially conflicting information?

3. **Email Generation**
   - What components should the email include? (e.g., greeting, summary, detailed answers, next steps)
   - How will you maintain a professional tone while being technically accurate?
   - How will you cite or reference the sources used?

Take some time to sketch out your pipeline design before proceeding. This planning phase will help you better understand the implementation requirements and potential challenges.

## Understanding the Codebase
Let's explore the key components that will power this advanced RAG system:

### 1. Query UI (`src/app/query/page.tsx`)
- The email query interface to submit a customer transcript
- Based on the transcript we technical topics that have been asked
- Based on the technical questions we research the anwers that are referenced in our knowledge base.

### 2. LangChain Configuration (`src/lib/langchain/config.tsx`)
- Defines prompt templates for each step in the pipeline
- Configures output parsers for structured responses
- Key sections:
  - Email generation prompt template (lines 1033-1055)
  - Output parser configurations (lines 1058-1073)

### 3. Transcript Summary Chain (`src/lib/langchain/TranscriptSummChain.tsx`)
- Implements the core RAG pipeline using [LangChain's](https://v03.api.js.langchain.com/classes/_langchain_core.runnables.RunnableSequence.html) `RunnableSequence`
- The `processTranscript` method parents the core chaining logic
- Handles:
  - Task extraction from transcripts
  - Vector search integration
  - Research compilation
  - Email generation
- Notable components:
  - Chain initialization and types (lines 1-33)
  - Vector search integration (lines 94-113)
  - Research chain setup (lines 119-129)

## Step 1: TaskExtraction Chain
In the sample implementation the email generation is split into: 
1. TaskExtraction Chain
2. Research Chain
3. Email Generation Chain

The TaskExtraction Chain is the first crucial component in our email generation pipeline. Its primary purpose is to analyze a customer transcript and identify specific technical questions or tasks that need to be researched and addressed in the follow-up email.

### Chain Requirements

The chain should:
1. Take a transcript as input
2. Analyze the content to identify technical questions or tasks


### Expected Input/Output

**Input Example:**
```typescript
{
  transcript: `
    Customer: We're thinking about implementing Cloud Run, but I'm concerned about the cold start times.
    Also, how does the pricing work when we have multiple revisions deployed?
    
    Agent: Those are great questions. Let me look into those details for you and include them in my follow-up email.
  `
}
```

**Expected Output Example:**
```typescript
[
  {
    description: "What are the strategies to minimize cold start times in Cloud Run?"
  },
  {
    description: "How does Cloud Run pricing work with multiple revisions deployed?"
  }
]
```

### Implementation Details

These are the components that our chain should use: 

**A parsed input variable:**
```typescript
{
transcript: (input: { transcript: string }) => input.transcript,
},
```

**A prompt template:**
```typescript
PROMPT_TEMPLATES.taskExtraction,
```

**A model:**
```typescript
model
```

**A structured output parser:**
```typescript
taskParser
```

Use the [Langchain Documentation](https://v03.api.js.langchain.com/classes/_langchain_core.runnables.RunnableSequence.html) to complete the codebase for the correct RunnableSequence definition in the TaskExtraction case.


## Step 2: Chain Orchestration
Consider the `processTranscript` method that orchestrates the chains we created. Make sure all chains are invoked correclty, receiving the parameters that they require. Use the [LangChain Documentation](https://js.langchain.com/docs/how_to/sequence/#the-pipe-method) to find the correct syntax.


## Next Steps
Congratulations you finished challenge 4. On to the next one ...
