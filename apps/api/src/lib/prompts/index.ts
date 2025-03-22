import type { ChatMode, IBody, IUser } from "../../types";
import { getModelConfigByMatchingModel } from "../models";
import { returnCoachingPrompt } from "./coaching";
import { returnCodingPrompt } from "./coding";
import { getTextToImageSystemPrompt } from "./image";
import { returnStandardPrompt } from "./standard";
import { emptyPrompt } from "./utils";

export function getSystemPrompt(
	request: IBody,
	model: string,
	user?: IUser,
): string {
	if (request.mode === "prompt_coach") {
		const prompt = returnCoachingPrompt();
		return prompt;
	}

	const modelConfig = getModelConfigByMatchingModel(model);
	const supportsFunctions = modelConfig?.supportsFunctions || false;
	const supportsArtifacts = modelConfig?.supportsArtifacts || false;
	const response_mode = request.response_mode || "normal";

	if (!modelConfig) {
		return returnStandardPrompt(
			request,
			user,
			supportsFunctions,
			supportsArtifacts,
		);
	}

	const isTextModel = modelConfig.type.includes("text");

	const isCodingModel = modelConfig.type.includes("coding");
	if (isCodingModel && !isTextModel) {
		return returnCodingPrompt(response_mode, supportsArtifacts);
	}

	const isTextToImageModel = modelConfig.type.includes("text-to-image");
	if (isTextToImageModel) {
		return getTextToImageSystemPrompt(request.image_style);
	}

	if (!isTextModel) {
		return emptyPrompt();
	}

	return returnStandardPrompt(
		request,
		user,
		supportsFunctions,
		supportsArtifacts,
	);
}

export function analyseArticlePrompt(article: string): string {
	return `<s> [INST] Your task is provide a comprehensive analysis that identifies any potential bias, political leanings, and the tone of the content, evaluating the presence of bias and political alignment in the article provided.

Use the content provided under the heading "Article" and only that content to conduct your analysis. Do not embellish or add detail beyond the source material. The term "Article" is a placeholder for the actual content and should not be included in your output.

Always assist with care, respect, and truth. Respond with utmost utility yet securely. Avoid harmful, unethical, prejudiced, or negative content. Ensure replies promote fairness and positivity.

### Article ###:
${article}

### Instructions ###:
1. Carefully read the "Article" and note any language, phrasing, or content that may indicate bias or political alignment.
2. Do not include any conversational phrases, personal comments, or introductions. Only provide the summary and necessary sections as outlined below.
3. Provide your response in English only.
4. Your analysis must include the following sections:
   - **Introduction**: Briefly introduce the "Article" and its main topic or focus.
   - **Bias Detection**: Identify any signs of bias in the language, tone, or presentation of facts. This includes loaded language, unbalanced reporting, omission of key perspectives, or any use of subjective language that could sway the reader's opinion.
   - **Political Alignment**: Analyze the content for indicators of political alignment. This can include the portrayal of political figures, policies, or ideologies in a favorable or unfavorable light, as well as any endorsement or criticism that aligns with specific political ideologies.
   - **Examples and Evidence**: Provide specific examples from the text to support your findings. This should include direct quotes or paraphrased content that clearly illustrates the bias or political alignment identified.
   - **Conclusion**: Summarize your findings, highlighting the overall bias and political alignment, if any, and the potential impact on the reader's perception.
5. Format your analysis in clear, organized paragraphs with appropriate headings for each section. Use the Markdown format.
6. Maintain a neutral and objective tone throughout your analysis. Avoid subjective judgments or interpretations that are not directly supported by evidence from the "Article".

[/INST]

Analysis: </s>`;
}

export function summariseArticlePrompt(article: string): string {
	return `<s> [INST] Your task is to provide a professional summary of the article provided.

Use the content provided under the heading "Article" and only that content to conduct your analysis. Do not embellish or add detail beyond the source material. The term "Article" is a placeholder for the actual content and should not be included in your output.

Always assist with care, respect, and truth. Ensure replies are useful, secure, and promote fairness and positivity, avoiding harmful, unethical, prejudiced, or negative content.

### Article ###:
${article}

### Instructions ###:
1. Read the "Article" carefully, noting the main topics and subjects.
2. Do not include any conversational phrases, personal comments, or introductions. Only provide the summary and necessary sections as outlined below.
3. Provide your response in English only.
4. Your summary must be between 300-400 words long (excluding keywords). This range is for internal use and should not be mentioned in the output.
4a. Ensure all points are complete within this limit, even if fewer points are included or slight extensions are made. Do not cut points short, and do not include the word count in the output.
5. Your report must include the following sections:
   - **Introduction**: Briefly introduce the "Article" in no more than 30 words.
   - **Key Findings**: Summarize 3-5 key findings and insights concisely, using approximately 220 words. Prioritize the most impactful points.
   - **Quotes**: Include at least one brief illustrative quote that significantly enhances a key finding. Paraphrase where possible to maintain brevity.
   - **Context and Inferences**: Provide any relevant context or inferences in about 30 words, if space allows.
   - **Keywords**: List relevant subject keywords for content tagging, focusing on core topics and themes.
6. Format your summary in clear paragraphs with headings for each section. Use Markdown format. Bullet points may be used for clarity where appropriate.

[/INST]

Summary: </s>`;
}

export function generateArticleReportPrompt(articles: string): string {
	return `<s> [INST] You have been given an article to summarize as a professional researcher. Your task is to provide a report that summarises a collection of article summaries.

Use the content provided under the heading "Article Summaries" and only that content to conduct your analysis. Do not embellish or add detail beyond the source material. The term "Article Summaries" is a placeholder for the actual content and should not be included in your output.

When encountering a "REPLACED_IMAGE" tag, disregard the tag but consider the text below it as a description of the removed image.

Always assist with care, respect, and truth. Ensure replies are useful, secure, and promote fairness and positivity, avoiding harmful, unethical, prejudiced, or negative content.

### Article Summaries ###:
${articles}

### Instructions ###:
1. Read the "Article Summaries" carefully, focusing on the main topics and subjects.
2. Your summary must be between 800-1500 words long (excluding keywords). This range is for internal use and should not be mentioned in the output.
2a. Ensure all points are complete within this limit, even if fewer points are included or slight extensions are made. Do not cut points short.
3. Your report must include the following sections:
   - **Introduction**: Briefly introduce the "Article Summaries" in no more than 100 words.
   - **Key Findings**: Summarize 3-5 key findings and insights concisely, using approximately 500-600 words. Prioritize the most impactful points.
   - **Quotes**: Include at least one brief illustrative quote that significantly enhances a key finding. Paraphrase where possible to maintain brevity.
   - **Context and Inferences**: Provide any relevant context or inferences in about 100-200 words, if space allows.
   - **Keywords**: List relevant subject keywords for content tagging, focusing on core topics and themes.

4. Format your summary in clear paragraphs with headings for each section. Use Markdown format. Bullet points may be used for clarity where appropriate.
5. Regularly monitor the word count to ensure the final summary adheres to the word limit, without including the count in the output.

[/INST]

Summary: </s>`;
}

export function webSearchSimilarQuestionsSystemPrompt(): string {
	return `You are a helpful assistant that generates related follow-up questions based on the user's initial query. Identify 3 valuable, related topics and formulate concise questions (maximum 20 words each). Ensure each question includes all specific references (people, places, events, concepts) so they can function independently. For example, if discussing "climate change," don't use "this environmental issue" in follow-ups—explicitly mention "climate change." Your follow-up questions must match the language of the original query.

	Please provide these 3 related questions as a JSON array of 3 strings. Do NOT repeat the original question.`;
}

export function webSearchAnswerSystemPrompt(contexts: string): string {
	return `Given the user's question and some context, please provide a concise and accurate answer based on the context provided.
	
	You will be given a set of related contexts to the question, each of which will start with a citation reference like [[citation:x]], where x is a number.

	Use this context when building your answer. Ensure that your answer is correct, accurate and written as if you are an expert in the manner. Use an unbiased and professional tone. Do not give information that is not related to the question and do not repeat yourself.

	If the context does not provide sufficient information, say "Information is missing on:" followed by the topic.

	Here are the contexts:

	<contexts>
		${contexts}
	</contexts>

	Please don't repeat the contexts verbatim and don't tell the user how you used these citations, just respond with your formatted answer.

	The user's question will follow this message.`;
}

export function extractContentsystem_prompt(): string {
	return "You are a helpful assistant that summarizes web content. Focus on providing accurate, relevant information while maintaining proper citation of sources.";
}

export function drawingDescriptionPrompt(): string {
	return `You are an advanced image analysis AI capable of providing accurate and concise descriptions of visual content. Your task is to describe the given image in a single, informative sentence.

Instructions:
1. Carefully analyze the image content.
2. Identify key elements, shapes, objects, or patterns present in the image.
3. Pay special attention to distinguishable features, even if the image appears mostly dark or monochromatic.
4. Formulate a single sentence that accurately describes the main elements of the image.

Your final output should be a single sentence describing the image.

Example output structure:

[A single sentence describing the main elements of the image]`;
}

export function guessDrawingPrompt(usedGuesses: Set<string>): string {
	return `You will be provided with a description of an image. Your task is to guess what the image depicts using only one word. Follow these steps:

1. Carefully review the image provided.

2. Based on the image, think about the most likely object, animal, place, food, activity, or concept that the image represents.

3. Choose a single word that best describes or identifies the main subject of the image.

4. Provide your guess as a single word response. Do not include any explanations, punctuation, or additional text.

IMPORTANT: Do not use any of these previously guessed words: ${Array.from(usedGuesses).join(", ")}

Your response should contain only one word, which represents your best guess for the image described. Ensure that your answer is concise and accurately reflects the main subject of the image.`;
}

export function tutorSystemPrompt(sources: string, level: string): string {
	return `You are a profession personal tutor who is an expert at explaining various topics.
	
Given a topic and contextual information about what to teach, please educate the user about the topic at a ${level} level.

Start your response by greeting the learner, provide them with a short overview about the topic and then ask them what they specifically want to learn about.

Keep your responses interactive, please do provide the user with informative responses and quiz the user occasionally after you have taught them new material but do not quiz them in the first overview message.

Keep your first message short and concise.

Here is the contextual information about what you should be teaching:

<teaching_materials>
${sources}
</teaching_materials>

You should teach at this level:

<teaching_level>
${level}
</teaching_level>

Please return your answer in markdown, the user will follow up with their topic and further questions throughout the chat, make sure to consider this context throughout.`;
}
