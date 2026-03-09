export const MOCK_COURSES = [
  {
    title: 'Seven Habits by Franklin Covey',
    videoUrl: 'https://www.youtube.com/watch?v=ktlTxC4QG8g'
  },
  {
    title: 'Grooming and Etiquette',
    videoUrl: 'https://www.youtube.com/watch?v=I3Bf7fA9f2A'
  },
  {
    title: 'Induction Training',
    videoUrl: 'https://www.youtube.com/watch?v=5fYkQKXwP5k'
  },
  {
    title: 'Labor Law',
    videoUrl: 'https://www.youtube.com/watch?v=PmA4f6H4GfM'
  },
  {
    title: 'Business Writing',
    videoUrl: 'https://www.youtube.com/watch?v=4L4fM5a6QDw'
  },
  {
    title: 'Supervisory Skills Training by CIPM',
    videoUrl: 'https://www.youtube.com/watch?v=VfYvM8f2P2w'
  },
  {
    title: 'Problem Solving & Design Thinking',
    videoUrl: 'https://www.youtube.com/watch?v=_r0VX-aU_T8'
  },
  {
    title: 'Business Analytics',
    videoUrl: 'https://www.youtube.com/watch?v=2z4Jm8f2k9Y'
  },
  {
    title: 'Manager as a leader by foundation institute',
    videoUrl: 'https://www.youtube.com/watch?v=eXDNkwIeOqA'
  },
  {
    title: 'English Language Improvement (Business English) by British Council',
    videoUrl: 'https://www.youtube.com/watch?v=9x_2Q5hN6fY'
  },
  {
    title: 'Executive Development Program',
    videoUrl: 'https://www.youtube.com/watch?v=2x7x6WQfS9M'
  },
  {
    title: 'Finance for non-finance',
    videoUrl: 'https://www.youtube.com/watch?v=tY8f4nArxIc'
  },
  {
    title: 'Four Roles in Leardership by Franklin Covey',
    videoUrl: 'https://www.youtube.com/watch?v=4QJjQdL2sW8'
  },
  {
    title: 'Coaching & Mentoring',
    videoUrl: 'https://www.youtube.com/watch?v=6M4g2GfN8aU'
  }
].map((course, index) => ({
  id: `course-${index + 1}`,
  title: course.title,
  description: `${course.title} - mock course catalog item.`,
  durationHours: (index % 4) + 2,
  videoUrl: course.videoUrl
}));

const COURSE_VIDEO_URL_BY_TITLE = new Map(
  MOCK_COURSES.map((course) => [course.title.trim().toLowerCase(), course.videoUrl])
);

export const getMockCourseVideoUrlByTitle = (title) => {
  const key = typeof title === 'string' ? title.trim().toLowerCase() : '';
  return COURSE_VIDEO_URL_BY_TITLE.get(key) || null;
};
