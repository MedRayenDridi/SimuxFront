import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit {
  isLoggedIn = false;
  currentUser: any = null;

  // Features array
  features = [
    {
      icon: '💰',
      title: 'Smart Budgeting',
      description: 'AI-powered budget tracking and financial insights tailored to your spending habits.'
    },
    {
      icon: '📊',
      title: 'Advanced Analytics',
      description: 'Detailed financial reports and visualization to help you understand your money flow.'
    },
    {
      icon: '🎯',
      title: 'Personalized Goals',
      description: 'Set and track financial goals with AI recommendations based on your profile.'
    },
    {
      icon: '🔒',
      title: 'Secure Tracking',
      description: 'Monitor login activity and secure your financial data with advanced protection.'
    },
    {
      icon: '🤖',
      title: 'AI Financial Advisor',
      description: 'Get personalized financial advice based on your knowledge level and preferences.'
    },
    {
      icon: '📱',
      title: 'Anywhere Access',
      description: 'Access your financial dashboard from any device, anytime.'
    }
  ];

  // Testimonials
  testimonials = [
    {
      name: 'Sarah M.',
      role: 'Freelancer',
      content: 'This app helped me save 30% more by understanding my spending patterns. The AI insights are incredible!',
      avatar: '👩‍💼'
    },
    {
      name: 'Mike R.',
      role: 'Engineer',
      content: 'The AI financial advisor is like having a personal finance expert 24/7. Game changer!',
      avatar: '👨‍💻'
    },
    {
      name: 'Emma L.',
      role: 'Student',
      content: 'Perfect for beginners! The tone customization made financial learning easy and enjoyable.',
      avatar: '👩‍🎓'
    }
  ];

  // Statistics
  stats = [
    { number: '10K+', label: 'Active Users' },
    { number: '50%', label: 'Average Savings Increase' },
    { number: '24/7', label: 'AI Support' },
    { number: '99%', label: 'User Satisfaction' }
  ];

  // How it works steps
  steps = [
    {
      number: '1',
      title: 'Create Your Profile',
      description: 'Tell us about your financial knowledge level, preferences, and goals'
    },
    {
      number: '2',
      title: 'Get AI Insights',
      description: 'Receive personalized recommendations and automated spending analysis'
    },
    {
      number: '3',
      title: 'Track Progress',
      description: 'Monitor your financial health with real-time dashboards and reports'
    },
    {
      number: '4',
      title: 'Achieve Goals',
      description: 'Reach your financial targets with guided recommendations'
    }
  ];

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = this.userService.isAuthenticated();
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // Get greeting based on time of day
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  // Get user greeting
  getUserGreeting(): string {
    if (this.currentUser) {
      return `${this.getGreeting()}, ${this.currentUser.firstName}!`;
    }
    return 'Take Control of Your Financial Future';
  }

  // Get user info for display
  getUserInfo(): string {
    if (this.currentUser) {
      return `Ready to continue your financial journey?`;
    }
    return 'AI-powered financial management for everyone';
  }

  // Simulate login for demo (remove in production)
  simulateLogin(): void {
    const testUser = {
      userId: 1,
      firstName: 'Alex',
      lastName: 'Johnson',
      email: 'alex@example.com',
      dateOfBirth: '1990-01-01',
      gender: 'MALE',
      profession: 'Software Developer',
      aiTonePreference: 'FRIENDLY',
      financialKnowledgeLevel: 'INTERMEDIATE',
      phoneNumber: '+1 234 567 8900',
      role: { id: 1, name: 'ROLE_USER' }
    };
    
    // Use the service method instead of directly accessing the BehaviorSubject
    this.userService.setCurrentUserForDemo(testUser);
  }

  logout(): void {
    this.userService.logout();
  }
}