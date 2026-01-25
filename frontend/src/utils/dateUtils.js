/**
 * Calculates the number of days between the start date and today.
 * @param {string|Date} startDate 
 * @returns {number} Days count
 */
export const getDaysTogether = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    
    // Reset hours to ensure pure day calculation
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = now - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0; 
};

/**
 * Calculates the next occurrence of a specific month and day.
 * Automatically handles year rollover (if date passed this year, returns next year).
 * @param {number} month - 0-indexed (0 = Jan, 11 = Dec)
 * @param {number} day 
 * @returns {Date} The next occurrence date object
 */
export const getNextEventDate = (month, day) => {
    const now = new Date();
    // Default to current year
    let eventDate = new Date(now.getFullYear(), month, day);
    
    // Reset hours for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If the event has already passed this year, move to next year
    if (eventDate < today) {
        eventDate.setFullYear(now.getFullYear() + 1);
    }
    
    return eventDate;
};

/**
 * Calculates days remaining until a future date.
 * @param {Date} targetDate 
 * @returns {number} Days remaining
 */
export const getDaysRemaining = (targetDate) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formats a date to a readable string (e.g., "Feb 14, 2024")
 * @param {Date} date 
 * @returns {string}
 */
export const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
