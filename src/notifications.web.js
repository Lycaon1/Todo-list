// Home-screen web app: phones don't let web apps schedule alerts while closed, so reminders
// are only available in the installed Android / iOS app.
export const remindersSupported = false;

export const getReminderPermission = async () => 'unsupported';
export const requestReminderPermission = async () => 'unsupported';
export const scheduleReminders = async () => 0;
export const cancelReminders = async () => {};
