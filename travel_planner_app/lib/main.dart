import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:travel_planner_app/providers/planner_provider.dart';

import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/main_screen.dart'; // 🆕 引入帶有底部導覽列的主框架 MainScreen
import 'theme/app_theme.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PlannerProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Travel Planner',
      theme: buildTravelPlannerTheme(),
      home: Consumer<AuthProvider>(
        builder: (context, auth, child) {
          if (auth.isLoading) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }

          if (auth.isAuthenticated) {
            // 🆕 登入成功後，直接進入帶有底部導覽列的 MainScreen！
            return const MainScreen();
          }

          return const LoginScreen();
        },
      ),
    );
  }
}