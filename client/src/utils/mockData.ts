import { User, LearningPath, Enrollment, Notification, Course } from '../types';

export const MOCK_USERS: User[] = [
{
  id: 'u1',
  name: 'Sarah Connor',
  email: 'admin@lpms.com',
  role: 'SUPER_ADMIN',
  avatar: 'https://i.pravatar.cc/150?u=u1',
  designation: 'System Administrator'
},
{
  id: 'u2',
  name: 'John Smith',
  email: 'ladmin@lpms.com',
  role: 'LEARNING_ADMIN',
  avatar: 'https://i.pravatar.cc/150?u=u2',
  designation: 'Head of L&D',
  department: 'Human Resources'
},
{
  id: 'u3',
  name: 'Emily Chen',
  email: 'supervisor@lpms.com',
  role: 'SUPERVISOR',
  avatar: 'https://i.pravatar.cc/150?u=u3',
  designation: 'Engineering Manager',
  department: 'Engineering'
},
{
  id: 'u4',
  name: 'Mike Ross',
  email: 'employee@lpms.com',
  role: 'EMPLOYEE',
  avatar: 'https://i.pravatar.cc/150?u=u4',
  designation: 'Software Engineer',
  department: 'Engineering'
}];


export const MOCK_COURSES: Course[] = [
{
  id: 'c1',
  code: 'SEC101',
  title: 'Information Security Basics',
  description: 'Fundamental security practices.',
  duration: '1h',
  type: 'ONLINE'
},
{
  id: 'c2',
  code: 'LDR201',
  title: 'Effective Leadership',
  description: 'Leading teams effectively.',
  duration: '4h',
  type: 'CLASSROOM'
},
{
  id: 'c3',
  code: 'DEV301',
  title: 'Advanced React Patterns',
  description: 'Deep dive into React.',
  duration: '6h',
  type: 'ONLINE'
},
{
  id: 'c4',
  code: 'CMP101',
  title: 'Company Compliance',
  description: 'Annual compliance training.',
  duration: '2h',
  type: 'ONLINE'
}];


export const MOCK_PATHS: LearningPath[] = [
{
  id: 'lp1',
  title: 'New Hire Onboarding',
  description: 'Essential training for all new employees.',
  category: 'RESTRICTED',
  status: 'ACTIVE',
  totalDuration: '3h',
  createdAt: '2023-01-15',
  stages: [
  { id: 's1', title: 'Welcome', order: 1, courses: [MOCK_COURSES[3]] },
  { id: 's2', title: 'Security', order: 2, courses: [MOCK_COURSES[0]] }]

},
{
  id: 'lp2',
  title: 'Engineering Excellence',
  description: 'Advanced technical skills for engineers.',
  category: 'SEMI_RESTRICTED',
  status: 'ACTIVE',
  totalDuration: '6h',
  createdAt: '2023-02-20',
  stages: [
  { id: 's3', title: 'Core Skills', order: 1, courses: [MOCK_COURSES[2]] }]

},
{
  id: 'lp3',
  title: 'Leadership 101',
  description: 'Introduction to management roles.',
  category: 'PUBLIC',
  status: 'ACTIVE',
  totalDuration: '4h',
  createdAt: '2023-03-10',
  stages: [
  { id: 's4', title: 'Basics', order: 1, courses: [MOCK_COURSES[1]] }]

}];


export const MOCK_ENROLLMENTS: Enrollment[] = [
{
  id: 'e1',
  userId: 'u4',
  learningPathId: 'lp1',
  status: 'COMPLETED',
  progress: 100,
  enrolledAt: '2023-06-01',
  completedAt: '2023-06-05'
},
{
  id: 'e2',
  userId: 'u4',
  learningPathId: 'lp2',
  status: 'IN_PROGRESS',
  progress: 45,
  enrolledAt: '2023-07-10'
}];


export const MOCK_NOTIFICATIONS: Notification[] = [
{
  id: 'n1',
  userId: 'u4',
  title: 'Course Assigned',
  message: 'You have been enrolled in "New Hire Onboarding".',
  type: 'INFO',
  read: false,
  createdAt: '2023-06-01'
},
{
  id: 'n2',
  userId: 'u4',
  title: 'Congratulations!',
  message: 'You completed "New Hire Onboarding".',
  type: 'SUCCESS',
  read: true,
  createdAt: '2023-06-05'
}];