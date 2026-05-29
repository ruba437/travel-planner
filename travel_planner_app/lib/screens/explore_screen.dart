import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'city_guide_screen.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  List<dynamic> _cities = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchCities();
  }

  // 🌍 取得後端 URL
  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  // 🌍 動態抓取城市列表
  Future<void> _fetchCities() async {
    try {
      final res = await http.get(Uri.parse('${_getBaseUrl()}/api/cities'));
      
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        if (json['success'] == true && json['data'] != null) {
          setState(() {
            _cities = json['data'];
            _isLoading = false;
          });
          return;
        }
      }
      throw Exception('無法取得城市資料 (HTTP ${res.statusCode})');
    } catch (e) {
      debugPrint('Fetch cities error: $e');
      setState(() {
        _errorMessage = '載入失敗，請稍後再試。';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('探索世界', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 1,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)));
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
                setState(() {
                  _isLoading = true;
                  _errorMessage = null;
                });
                _fetchCities();
              },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F766E)),
              child: const Text('重試'),
            )
          ],
        ),
      );
    }

    if (_cities.isEmpty) {
      return const Center(child: Text('目前還沒有熱門城市喔！', style: TextStyle(color: Colors.grey)));
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, 
        childAspectRatio: 0.8, 
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: _cities.length,
      itemBuilder: (context, index) {
        final cityData = _cities[index];
        final cityName = cityData['city'] ?? '未命名城市';
        // 你的後端 city 欄位就是 slug 的角色，cover_image 則是圖片網址
        final coverImage = cityData['cover_image'] ?? 'https://via.placeholder.com/600x800';

        return GestureDetector(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (context) => CityGuideScreen(
                  cityName: cityName, 
                  citySlug: cityName, // 將 city 作為 slug 傳遞給詳細頁
                ),
              ),
            );
          },
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 3))],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    coverImage,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      debugPrint('圖片載入失敗: $cityName - $error');
                      return Container(
                        color: Colors.grey[300],
                        child: const Icon(Icons.broken_image, color: Colors.grey, size: 40),
                      );
                    },
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black.withOpacity(0.7)],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    left: 16,
                    child: Text(
                      cityName,
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}