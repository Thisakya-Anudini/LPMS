import {
  Award,
  BookOpen,
  FolderKanban,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Shield,
  Sparkles,
  UserCog,
  Users
} from 'lucide-react';
import { User } from '../../types';

type NavigationIcon = typeof LayoutDashboard;

export type NavigationLink = {
  label: string;
  to: string;
  icon: NavigationIcon;
  matchMode?: 'exact' | 'prefix';
};

export type NavigationGroup = {
  label: string;
  icon: NavigationIcon;
  links: NavigationLink[];
};

export type NavigationModel = {
  primaryLinks: NavigationLink[];
  groups: NavigationGroup[];
  quickLinks: NavigationLink[];
};

const learnerLinks: NavigationLink[] = [
  {
    label: 'My Learning',
    to: '/learner/my-progress',
    icon: GraduationCap
  },
  {
    label: 'Public Paths',
    to: '/learner/public-paths',
    icon: Sparkles
  },
  {
    label: 'Certificates',
    to: '/learner/certificates',
    icon: Award
  }
];

const learningAdminLinks: NavigationLink[] = [
  {
    label: 'Dashboard',
    to: '/learning-admin',
    icon: LayoutDashboard,
    matchMode: 'exact'
  },
  {
    label: 'Create LP',
    to: '/learning-admin/paths/create',
    icon: BookOpen
  },
  {
    label: 'Assign Enrollments',
    to: '/learning-admin/paths/assign',
    icon: Users
  },
  {
    label: 'Manage LPs',
    to: '/learning-admin/paths/manage',
    icon: FolderKanban
  },
  {
    label: 'Certificates',
    to: '/learning-admin/certificates',
    icon: Shield
  },
  {
    label: 'Assignment Reports',
    to: '/learning-admin/assignment-reports',
    icon: LineChart
  }
];

export function getNavigationModel(user: User): NavigationModel {
  if (user.role === 'SUPER_ADMIN') {
    return {
      primaryLinks: [
        {
          label: 'Learners',
          to: '/admin/learners',
          icon: Users
        },
        {
          label: 'System Accounts',
          to: '/admin/accounts',
          icon: LayoutDashboard
        },
        {
          label: 'Hierarchy',
          to: '/admin/hierarchy',
          icon: GitBranch
        },
        {
          label: 'Learning Paths',
          to: '/admin/learning-paths',
          icon: BookOpen
        }
      ],
      groups: [],
      quickLinks: []
    };
  }

  if (user.role === 'LEARNING_ADMIN') {
    return {
      primaryLinks: [
        {
          label: 'Dashboard',
          to: '/learning-admin',
          icon: LayoutDashboard,
          matchMode: 'exact'
        }
      ],
      groups: [
        {
          label: 'Learning Paths',
          icon: BookOpen,
          links: learningAdminLinks.slice(1, 4)
        },
        {
          label: 'Operations',
          icon: Shield,
          links: learningAdminLinks.slice(4)
        }
      ],
      quickLinks: learningAdminLinks
    };
  }

  const groups: NavigationGroup[] = [];
  const primaryLinks = [...learnerLinks];

  if (user.isLearningAdmin) {
    groups.push({
      label: 'Learning Admin',
      icon: UserCog,
      links: learningAdminLinks
    });
  }

  if (user.isSupervisor) {
    primaryLinks.push({
      label: 'Supervisor',
      to: '/supervisor',
      icon: UserCog
    });
  }

  return {
    primaryLinks,
    groups,
    quickLinks: [...learnerLinks, ...(user.isLearningAdmin ? learningAdminLinks : []), ...(user.isSupervisor ? [{
      label: 'Supervisor Dashboard',
      to: '/supervisor',
      icon: UserCog
    }] : [])]
  };
}

export function isLinkActive(pathname: string, link: NavigationLink) {
  if (link.matchMode === 'exact') {
    return pathname === link.to;
  }

  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export function isGroupActive(pathname: string, group: NavigationGroup) {
  return group.links.some((link) => isLinkActive(pathname, link));
}
