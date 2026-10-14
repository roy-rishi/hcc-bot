import {
    ComponentType,
    InteractionCallbackType,
    DISCORD_HEADERS,
} from './constants';

// the machine-readable values that underlie question options
type AnswerVal = "A" | "B" | "C" | "D" | "E" | "F";
const answerVals = ["A", "B", "C", "D", "E", "F"];

// an abstract class for quiz questions
abstract class Question {
    readonly label: string;
    readonly options: string[];

    constructor(label: string, options: string[]) {
        if (label.length > 45 || options.length < 2 || options.length > 6)  // TODO: check limits
            throw new Error("Invalid length of one or more args");

        this.label = label;
        this.options = options;
    }

    // returns a Discord API–compliant object
    abstract toDiscordObject(index: number): any;
}

// a single-select (radio) question
class SingleSelectQuestion extends Question {
    readonly answer: AnswerVal;

    constructor(label: string, options: string[], answer: AnswerVal) {
        super(label, options);
        this.answer = answer;
    }

    toDiscordObject(index: number) {
        return {
            type: ComponentType.LABEL,
            label: this.label,
            component: {
                type: ComponentType.RADIO_GROUP,
                custom_id: `q-${index}`,
                options: this.options.map((elem, i) => {
                    return {
                        "value": answerVals[i],
                        "label": elem,
                    };
                }),
            }
        }
    }
}

// a page has a topic heading, description, and list of up to 4 questions
class Page {
    readonly heading: string;
    readonly description: string;
    readonly questions: Question[];

    constructor(heading: string, description: string, questions: Question[]) {
        if (questions.length > 4)
            throw new Error("Too many questions");

        this.heading = heading;
        this.description = description;
        this.questions = questions;
    }

    toDiscordObject(index: number) {
        return {
            custom_id: `quiz-${index}`,
            title: `Safety Quiz — Part ${index + 1}`,
            components: [
                {
                    type: ComponentType.TEXT_DISPLAY,
                    content: `**${this.heading}**\n${this.description}`,
                },
                ...this.questions.map((elem, idx) => elem.toDiscordObject(idx)),
            ]
        }
    }
}

// defines the questions and answers for every quiz page
const quizData: Page[] = [
    new Page(
        "Hand Signals",
        "Select the hand signal that you should use in each of the following scenarios:",
        [
            new SingleSelectQuestion(
                "Stopping",
                ["Left arm extended", "Right arm extended", "Open palm facing back", "Flare both elbows"],
                "C",
            ),
            new SingleSelectQuestion(
                "Getting out of the saddle",
                ["Left arm extended", "Right arm extended", "Open palm facing back", "Flare both elbows"],
                "D",
            ),
            new SingleSelectQuestion(
                "Turning left",
                ["Left arm extended", "Right arm extended", "Open palm facing back", "Flare both elbows"],
                "A",
            ),
            new SingleSelectQuestion(
                "Turning right",
                ["Left arm extended", "Right arm extended", "Open palm facing back", "Flare both elbows"],
                "B",
            ),
        ]
    ),
    new Page(
        "Verbal Cues",
        "Select what you should call out in each of the following scenarios:",
        [
            new SingleSelectQuestion(
                "A car is coming up ahead",
                ["Car back!", "Stopping!", "Car up!", "Pole!"],
                "C",
            ),
            new SingleSelectQuestion(
                "A bollard is in the middle of the path",
                ["Car back!", "Stopping!", "Car up!", "Pole!"],
                "D",
            ),
            new SingleSelectQuestion(
                "A car is passing from behind",
                ["Car back!", "Stopping!", "Car up!", "Pole!"],
                "A",
            ),
            new SingleSelectQuestion(
                "You are stopping suddenly",
                ["Car back!", "Stopping!", "Car up!", "Pole!"],
                "B",
            ),
        ]
    )
];

// create a response containing a safety quiz modal
export let getQuizModal = function (pageIndex: number): Response {
    const modalData = quizData[pageIndex].toDiscordObject(pageIndex);

    const modal = {
        type: InteractionCallbackType.MODAL,
        data: modalData
    }

    return new Response(JSON.stringify(modal), { status: 200, headers: DISCORD_HEADERS });
}
