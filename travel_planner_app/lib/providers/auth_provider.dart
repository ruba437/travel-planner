import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart'; // 🆕 引入 kIsWeb 用來判斷是否為網頁版
import 'dart:io' show Platform; // 🆕 引入 Platform 用來判斷作業系統

class AuthProvider with ChangeNotifier {
  
  String get _baseUrl {
    if (kIsWeb) {
      return 'http://localhost:8888'; // 網頁版測試
    } else if (Platform.isAndroid) {
      return 'http://10.0.2.2:8888'; // Android 模擬器
    } else {
      return 'http://127.0.0.1:8888'; // iOS 模擬器
    }
  } 

  Map<String, dynamic>? _user;
  String? _token;
  bool _isLoading = true;

  Map<String, dynamic>? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null;

  AuthProvider() {
    _loadTokenAndFetchUser();
  }

  // 對應 React 的 useEffect (一開啟 APP 檢查有沒有登入過)
  Future<void> _loadTokenAndFetchUser() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');

    if (_token != null) {
      try {
        final res = await http.get(
          Uri.parse('$_baseUrl/api/auth/me'),
          headers: {'Authorization': 'Bearer $_token'},
        );

        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          _user = data['user'];
        } else {
          // Token 過期或無效
          _token = null;
          await prefs.remove('token');
        }
      } catch (e) {
        print('初始化登入狀態失敗: $e');
        _token = null;
      }
    }
    
    _isLoading = false;
    notifyListeners(); // 通知畫面更新 (類似 setState)
  }

  // 對應 React 的 login 函數
  Future<void> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(res.body);

    if (res.statusCode != 200) {
      throw Exception(data['error'] ?? '登入失敗');
    }

    _token = data['token'];
    _user = data['user'];

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);

    notifyListeners();
  }

  // 對應 React 的 register 函數
  Future<void> register(String email, String password, String displayName) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password, 'displayName': displayName}),
    );

    final data = jsonDecode(res.body);

    if (res.statusCode != 201) { // 注意註冊成功你是回傳 201
      throw Exception(data['error'] ?? '註冊失敗');
    }

    _token = data['token'];
    _user = data['user'];

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', _token!);

    notifyListeners();
  }

  // 對應 React 的 logout 函數
  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    notifyListeners();
  }

  // 放在 auth_provider.dart 類別裡面的任何地方
  void updateUserData(Map<String, dynamic> newData) {
    if (_user != null) {
      _user = {..._user!, ...newData}; // 合併新舊資料
      notifyListeners(); // 廣播給所有畫面：「資料換囉！快更新顯示！」
    }
  }
}