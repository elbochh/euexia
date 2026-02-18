import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { invokeTextModel } from '../sagemaker';

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MedGemmaChatRequest {
  systemPrompt: string;
  history: ChatTurn[];
  userMessage: string;
}

export interface MedGemmaChatResponse {
  text: string;
  raw?: any;
}

function toBaseMessages(turns: ChatTurn[]): BaseMessage[] {
  return turns.map((turn) => {
    if (turn.role === 'assistant') return new AIMessage(turn.content);
    if (turn.role === 'system') return new SystemMessage(turn.content);
    return new HumanMessage(turn.content);
  });
}

function messagesToPromptString(messages: BaseMessage[]): string {
  return messages
    .map((msg) => {
      if (msg instanceof SystemMessage) return `System: ${msg.content}`;
      if (msg instanceof AIMessage) return `Assistant: ${msg.content}`;
      return `User: ${msg.content}`;
    })
    .join('\n');
}

/**
 * LangChain-backed adapter that still uses the existing MedGemma SageMaker endpoint.
 * No external model API key is required; it delegates to invokeTextModel().
 */
export async function invokeMedGemmaWithLangChain(
  request: MedGemmaChatRequest
): Promise<MedGemmaChatResponse> {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', '{systemPrompt}'],
    new MessagesPlaceholder('history'),
    ['human', '{userMessage}'],
  ]);

  const promptValue = await prompt.invoke({
    systemPrompt: request.systemPrompt,
    history: toBaseMessages(request.history),
    userMessage: request.userMessage,
  });
  const compactPrompt = messagesToPromptString(promptValue.toChatMessages());
  const result = await invokeTextModel(compactPrompt);
  const output = new AIMessage(result.text || '');

  return {
    text: String(output.content || '').trim(),
    raw: output,
  };
}

