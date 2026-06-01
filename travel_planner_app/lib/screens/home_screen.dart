import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'itinerary_screen.dart';
import 'ai_planner_screen.dart'; // 🆕 引入 AI 規劃器
import '../theme/app_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _itineraries = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchItineraries();
  }

  // 🌍 取得後端 URL
  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  // 📡 從後端取得使用者的所有行程 (除錯加強版)
  Future<void> _fetchItineraries() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) {
      setState(() {
        _errorMessage = '請先登入';
        _isLoading = false;
      });
      return;
    }

    // 🕵️ 印出 Token 看看有沒有東西
    debugPrint('=== 準備請求行程 ===');
    debugPrint('使用的 Token: ${token.substring(0, 15)}...'); 

    try {
      final res = await http.get(
        Uri.parse('${_getBaseUrl()}/api/itineraries'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      // 🕵️ 把後端真真實實回傳的內容印出來！
      debugPrint('後端狀態碼: ${res.statusCode}');
      debugPrint('後端回傳的 Body: ${res.body}');

      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        setState(() {
          _itineraries = json['itineraries'] ?? [];
          _isLoading = false;
          _errorMessage = null;
        });
      } else {
        throw Exception('無法取得行程資料 (HTTP ${res.statusCode})');
      }
    } catch (e) {
      debugPrint('Fetch itineraries error: $e');
      setState(() {
        _errorMessage = '載入失敗，請檢查網路連線。';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('我的行程', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      
      // 🤖 🆕 整合 AI 行程產生器入口
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AiPlannerScreen()),
          ).then((_) {
            // 從 AI 規劃頁面返回時，重新載入行程列表（因為可能產生了新行程）
            setState(() => _isLoading = true);
            _fetchItineraries();
          });
        },
        icon: const Icon(Icons.auto_awesome),
        label: const Text('AI 幫我排', style: TextStyle(fontWeight: FontWeight.bold)),
      ),

      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 16)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                setState(() => _isLoading = true);
                _fetchItineraries();
              },
              child: const Text('重試'),
            )
          ],
        ),
      );
    }

    // 📭 空狀態設計
    if (_itineraries.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.flight_takeoff, size: 80, color: AppColors.textMuted),
            const SizedBox(height: 16),
            const Text('還沒有任何行程喔！', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.text)),
            const SizedBox(height: 8),
            const Text('點擊右下角讓 AI 幫你規劃一趟完美旅程吧', style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 40), // 預留空間給 FAB
          ],
        ),
      );
    }

    // 📜 行程列表
    return RefreshIndicator(
      onRefresh: _fetchItineraries, // 下拉重整
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 80), // 底部留白避免被按鈕擋住
        itemCount: _itineraries.length,
        itemBuilder: (context, index) {
          final trip = _itineraries[index];
          final title = trip['title'] ?? '未命名行程';
          final city = trip['city'] ?? '未知城市';
          final startDate = trip['startdate'] ?? '';
          final summary = trip['summary'] ?? '';

          return Card(
            margin: const EdgeInsets.only(bottom: 16),
            elevation: 2,
            shadowColor: Colors.black12,
            color: AppColors.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    // 將整包資料傳給詳細頁
                    builder: (context) => ItineraryScreen(tripData: trip),
                  ),
                ).then((_) {
                  // 從詳細頁返回時，重新拉取資料（可能在裡面編輯了標題）
                  _fetchItineraries();
                });
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 上半部：標題與地點
                  Container(
                    width: double.infinity,
                    color: AppColors.teal.withOpacity(0.06),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.text),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: AppColors.textMuted),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(city, style: const TextStyle(fontSize: 14, color: AppColors.text)),
                            if (startDate.isNotEmpty) ...[
                              const SizedBox(width: 12),
                              const Icon(Icons.calendar_today, size: 14, color: AppColors.textMuted),
                              const SizedBox(width: 4),
                              Text(startDate.substring(0, 10), style: const TextStyle(fontSize: 14, color: AppColors.text)),
                            ]
                          ],
                        ),
                      ],
                    ),
                  ),
                  // 下半部：概要
                  if (summary.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        summary,
                        style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}