export interface Reservation {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  people: string;
  date: string;
  selectedTimes: string[];
  submissionCount: number;
}
