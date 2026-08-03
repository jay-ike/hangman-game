/**
* @template T
* @typedef {Object} ApiResponse
* @property {boolean} ok
* @property {T} data
*/
/**
* A Progress Indicator
* @typedef {Object} Progress
* @property {string} store
* @property {number} level
* @property {number} totalWords
* @property {number} uncovered
*/
/**
* An achievement Event
* @typedef {Object} AchievementEvent
* @property {string} achievementId
* @property {string} category
* @property {Number} level
* @property {string} playerId
* @property {Number} unlockedAt
*/
/**
* Game user data
* @typedef {Object} GameData
* @property {number} hearts
* @property {string} category
* @property {number} level
* @property {number} streak
* @property {string} word
* @property {{totalWords: number, uncovered: number}} progress
*/
/**
 * Payload for marking an item as found
 * @typedef {Object} FoundPayload
 * @property {string} category
 * @property {number} level
 * @property {string} word
 */
/**
 * @typedef {Object} ApiHandlerInstance
 * @property {(cat: string, level?: string) => Promise<ApiResponse<Progress | Array<Progress>>} getProgress - Fetch Progress for a category and optional level
 * @property {(l: string) => Promise<ApiResponse<Array<{id: string, events: AchievementEvent[]}>>} getBadges - Fetch the earned badges for a language
 * @property {() => Promise<ApiResponse<number>>} getHearts - Fetch the current hearts available
 * @property {(b: FoundPayload) => Promise<ApiResponse<Progress>>} markFound - mark a hidden item as found
 * @property {(b: Omit<FoundPayload, "word"> & {achievementId: string, lang: string}) => Promise<ApiResponse<string>>} addBadge - save a earned badge
 */
/**
* @typedef {Object} PointManagerInstance
* @property {(level: number) => {letter: number, item: number, guess: number}} getDeduction - get point deduction rule for the current level
* @property {(context: any) => Promise<{badges: Array<{title: string, points: number}>, points: number, progress: {uncovered: number, totalWords: number}}> handleItemFound - handle the user progression when an item is found
*
*/
/**
 * An item with a name.
 * @typedef {Object} Item
 * @property {string} name
 */
/**
 * A collection of items grouped under a dynamic sub‑key.
 * @typedef {Record<string, Item[]>} SubCategories
 */
/**
 * A data source from the API
 * @typedef {Object} Source
 * @property {Record<string, SubCategories>} categories
 */
/**
* @typedef {Object} QuestionData
* @property {string} name
* @property {number} level
* @property {"not-selected"|"selected"} status
*/
/**
* @typedef {Object} Question
* @property {string} store
* @property {QuestionData[]} datas
*/


export {};
