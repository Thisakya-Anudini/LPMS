export const MOCK_COURSES = [
  {
    title: 'Seven Habits by Franklin Covey',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=ktlTxC4QG8g'
  },
  {
    title: 'Grooming and Etiquette',
    deliveryMode: 'PHYSICAL',
    venue: 'SLT Training Center - Colombo'
  },
  {
    title: 'Induction Training',
    deliveryMode: 'PHYSICAL',
    venue: 'SLT HQ Auditorium'
  },
  {
    title: 'Labor Law',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=PmA4f6H4GfM'
  },
  {
    title: 'Business Writing',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=4L4fM5a6QDw'
  },
  {
    title: 'Supervisory Skills Training by CIPM',
    deliveryMode: 'PHYSICAL',
    venue: 'CIPM Colombo Campus'
  },
  {
    title: 'Problem Solving & Design Thinking',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=_r0VX-aU_T8'
  },
  {
    title: 'Business Analytics',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=2z4Jm8f2k9Y'
  },
  {
    title: 'Manager as a leader by foundation institute',
    deliveryMode: 'PHYSICAL',
    venue: 'Foundation Institute - Main Hall'
  },
  {
    title: 'English Language Improvement (Business English) by British Council',
    deliveryMode: 'PHYSICAL',
    venue: 'British Council Colombo'
  },
  {
    title: 'Executive Development Program',
    deliveryMode: 'PHYSICAL',
    venue: 'SLT Leadership Academy'
  },
  {
    title: 'Finance for non-finance',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=tY8f4nArxIc'
  },
  {
    title: 'Four Roles in Leardership by Franklin Covey',
    deliveryMode: 'ONLINE',
    videoUrl: 'https://www.youtube.com/watch?v=4QJjQdL2sW8'
  },
  {
    title: 'Coaching & Mentoring',
    deliveryMode: 'PHYSICAL',
    venue: 'SLT Regional Training Center - Kandy'
  }
].map((course, index) => ({
  id: `course-${index + 1}`,
  title: course.title,
  description: `${course.title} - mock course catalog item.`,
  durationHours: (index % 4) + 2,
  deliveryMode: course.deliveryMode,
  videoUrl: course.deliveryMode === 'ONLINE' ? course.videoUrl : null,
  venue: course.deliveryMode === 'PHYSICAL' ? course.venue : null
}));

const COURSE_VIDEO_URL_BY_TITLE = new Map(
  MOCK_COURSES.map((course) => [course.title.trim().toLowerCase(), course.videoUrl])
);

export const getMockCourseVideoUrlByTitle = (title) => {
  const key = typeof title === 'string' ? title.trim().toLowerCase() : '';
  return COURSE_VIDEO_URL_BY_TITLE.get(key) || null;
};

export const getMockCourseByTitle = (title) => {
  const key = typeof title === 'string' ? title.trim().toLowerCase() : '';
  return MOCK_COURSES.find((course) => course.title.trim().toLowerCase() === key) || null;
};

export const getMockCourseById = (id) =>
  MOCK_COURSES.find((course) => String(course.id) === String(id)) || null;
