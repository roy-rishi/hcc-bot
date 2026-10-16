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

    constructor(label: string) {
        if (label.length > 45)  // TODO: check limits
            throw new Error("Invalid label length");

        this.label = label;
    }

    // returns a Discord API–compliant object
    abstract toDiscordObject(index: number): any;
}

// a single-select (radio) question
class SingleSelectQuestion extends Question {
    readonly options: string[];
    readonly answer: AnswerVal;

    constructor(label: string, options: string[], answer: AnswerVal) {
        if (options.length < 2 || options.length > 6)
            throw new Error("Invalid options length");

        super(label);
        this.options = options;
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

// a multi-select (radio) question
class MultiSelectQuestion extends Question {
    readonly options: string[];
    readonly answers: AnswerVal[];

    constructor(label: string, options: string[], answers: AnswerVal[]) {
        if (options.length < 2 || options.length > 6 || answers.length > options.length)
            throw new Error("Invalid length of one or more args.");

        super(label);
        this.options = options;
        this.answers = answers;
    }

    toDiscordObject(index: number) {
        return {
            type: ComponentType.LABEL,
            label: this.label,
            component: {
                type: ComponentType.CHECKBOX_GROUP,
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

// a single yes/no checkbox question
class CheckboxQuestion extends Question {
    constructor(label: string) {
        super(label);
    }

    toDiscordObject(index: number) {
        return {
            type: ComponentType.LABEL,
            label: this.label,
            component: {
                type: ComponentType.CHECKBOX,
                custom_id: `q-${index}`,
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
                ["Extend right arm to the side", "Point towards the road", "Lower left arm and face palm backwards", "Flare both elbows"],
                "C",
            ),
            new SingleSelectQuestion(
                "Getting out of the saddle",
                ["Extend right arm to the side", "Point towards the road", "Lower left arm and face palm backwards", "Flare both elbows"],
                "D",
            ),
            new SingleSelectQuestion(
                "Turning right",
                ["Extend right arm to the side", "Point towards the road", "Lower left arm and face palm backwards", "Flare both elbows"],
                "A",
            ),
            new SingleSelectQuestion(
                "Passing a pothole",
                ["Extend right arm to the side", "Point towards the road", "Lower left arm and face palm backwards", "Flare both elbows"],
                "B",
            ),
        ]
    ),
    new Page(
        "Hand Signals (Cont.)",
        "Select the hand signal that you should use in each of the following scenarios:",
        [
            new SingleSelectQuestion(
                "Moving left to pass an obstacle",
                ["Point with one finger upwards", "Hold out one finger to the side", "Wrap right arm around your back & wave to the left", "Point towards the road"],
                "C",
            ),
            new SingleSelectQuestion(
                "The group is transitioning to single-file",
                ["Point with one finger upwards", "Hold out one finger to the side", "Wrap right arm around your back & wave to the left", "Point towards the road"],
                "A",
            ),
            new MultiSelectQuestion(
                "The rider(s) in front make a hand signal",
                ["Repeat the hand signal for riders behind you", "If you can’t remove your hands from the bars, call out the meaning of the signal as a verbal cue"],
                ["A", "B"],
            )
        ]
    ),
    new Page(
        "Verbal Cues",
        "Select what you should call out in each of the following scenarios:",
        [
            new SingleSelectQuestion(
                "A car is trying to pass from behind",
                ["Stopping!", "Car back!", "Post!", "Car up!"],
                "B",
            ),
            new SingleSelectQuestion(
                "A car is coming up ahead on a narrow road",
                ["Stopping!", "Car back!", "Post!", "Car up!"],
                "D",
            ),
            new SingleSelectQuestion(
                "Bollard/flexpost in the middle of the path",
                ["Stopping!", "Car back!", "Post!", "Car up!"],
                "C",
            ),
            new SingleSelectQuestion(
                "Stopping suddenly",
                ["Stopping!", "Car back!", "Post!", "Car up!"],
                "A",
            ),
        ]
    ),
    new Page(
        "Rules of the Road in Washington State",
        "\n*Refer to these options below*\n A. a white headlight\n B. a red taillight\n C. a red rear-facing reflector",
        [
            new MultiSelectQuestion(
                "When riding in the dark, you must have…",
                ["B", "A and B", "A and C", "A, B, and C"],
                ["C", "D"],
            ),
            new SingleSelectQuestion(
                "Stop signs…",
                ["do not require you to come to a complete stop", "do not require you to come to a complete stop IF there is no traffic in the intersection", "always require you to come to a complete stop"],
                "B",
            ),
            new MultiSelectQuestion(
                "Riding on the sidewalk…",
                ["is permitted anywhere in Washington state", "is only permitted in certain municipalities", "should be done with care to pedestrians’ safety", "is not always safer than riding on the road"],
                ["B", "C", "D"],
            ),
        ]
    ),
    new Page(
        "Agreement",
        "By selecting the checkbox below, you indicate your agreement to the following clauses:\n- I have read the Safety & Etiquette Policies.\n- I have discussed any concerns that I have regarding these policies with the Officer Team.\n- I understand that the Officer Team reserves the right to restrict my group ride participation should I repeatedly fail to comply with these policies.",
        [
            new CheckboxQuestion("I agree"),
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
