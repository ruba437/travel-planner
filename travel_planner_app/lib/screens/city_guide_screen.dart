import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class CityGuideScreen extends StatefulWidget {
  final String cityName; // 中文顯示用 (例如：東京)
  final String citySlug; // API 查詢用 (例如：Tokyo)

  const CityGuideScreen({
    super.key, 
    required this.cityName, 
    required this.citySlug,
  });

  @override
  State<CityGuideScreen> createState() => _CityGuideScreenState();
}

class _CityGuideScreenState extends State<CityGuideScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic> _guideData = {};
  Set<String> _savedSet = {}; 

  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  @override
  void initState() {
    super.initState();
    _fetchGuideData();
  }

  // 🌍 抓取城市指南資料
  Future<void> _fetchGuideData() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    
    // 💡 使用英文的 citySlug 來建構安全的 URL
    final url = Uri.parse('${_getBaseUrl()}/api/cities/${Uri.encodeComponent(widget.citySlug)}/guide');
    debugPrint('正在請求 API: $url'); // 除錯用：確保我們打對 URL

    try {
      final res = await http.get(
        url,
        headers: token != null ? {'Authorization': 'Bearer $token'} : {},
      );

      debugPrint('API 回應狀態碼: ${res.statusCode}');

      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        if (json['success'] == true && json['data'] != null) {
          final data = json['data'];
          _initSavedSet(data);
          setState(() {
            _guideData = data;
            _isLoading = false;
          });
          return;
        }
      } else {
        // 如果不是 200，印出後端回傳的錯誤內容，方便我們除錯
        debugPrint('API 回應內容: ${res.body}');
      }
      
      throw Exception('無法取得城市資料 (HTTP ${res.statusCode})');
    } catch (e) {
      debugPrint('Guide fetch error: $e');
      setState(() {
        _errorMessage = '載入失敗，請稍後再試。\n($e)';
        _isLoading = false;
      });
    }
  }

  void _initSavedSet(Map<String, dynamic> data) {
    final s = <String>{};
    final cats = ['places', 'hotels', 'restaurants', 'activities'];
    for (var cat in cats) {
      final items = data[cat] as List<dynamic>? ?? [];
      for (var item in items) {
        if (item['is_saved'] == true) {
          s.add('$cat:${item['id']}');
        }
      }
    }
    _savedSet = s;
  }

  Future<void> _toggleSave(String category, dynamic id) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('請先登入才能收藏喔！')));
      return;
    }

    final key = '$category:$id';
    final wasSaved = _savedSet.contains(key);

    setState(() {
      if (wasSaved) _savedSet.remove(key);
      else _savedSet.add(key);
    });

    try {
      final res = await http.post(
        Uri.parse('${_getBaseUrl()}/api/pois/$category/$id/save'),
        headers: {'Authorization': 'Bearer ${auth.token}'},
      );
      if (res.statusCode != 200 && res.statusCode != 201) throw Exception('Save failed');
    } catch (e) {
      setState(() {
        if (wasSaved) _savedSet.add(key);
        else _savedSet.remove(key);
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('❌ 收藏失敗，請檢查網路連線')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFF0F766E))));
    if (_errorMessage != null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.cityName)),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red, fontSize: 16)),
          ),
        ),
      );
    }

    final cityInfo = _guideData['city'] ?? {};
    final coverImage = cityInfo['cover_image'] ?? 'https://images.unsplash.com/photo-1488646953014-c8c07d192dd6?w=800&q=80';
    final description = cityInfo['description'] ?? '探索這座美麗城市的獨特魅力。';

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 250.0,
            pinned: true,
            backgroundColor: const Color(0xFF0F766E),
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(widget.cityName, style: const TextStyle(fontWeight: FontWeight.bold, textBaseline: TextBaseline.alphabetic, shadows: [Shadow(color: Colors.black45, blurRadius: 10)])),
              background: Image.network(coverImage, fit: BoxFit.cover, errorBuilder: (ctx, err, stack) => Container(color: Colors.grey)),
            ),
          ),
          
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Text(description, style: const TextStyle(fontSize: 16, height: 1.6, color: Colors.black87)),
            ),
          ),

          _buildCategorySection('必去景點 (Top Places)', 'places', Icons.camera_alt),
          _buildCategorySection('推薦住宿 (Hotels)', 'hotels', Icons.hotel),
          _buildCategorySection('熱門美食 (Restaurants)', 'restaurants', Icons.restaurant),
          _buildCategorySection('精選活動 (Activities)', 'activities', Icons.local_activity),
          
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  Widget _buildCategorySection(String title, String categoryKey, IconData icon) {
    final List<dynamic> items = _guideData[categoryKey] ?? [];
    if (items.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
            child: Row(
              children: [
                Icon(icon, color: const Color(0xFF0F766E), size: 20),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          SizedBox(
            height: 220,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final bool isSaved = _savedSet.contains('$categoryKey:${item['id']}');
                
                return Container(
                  width: 160,
                  margin: const EdgeInsets.only(right: 12),
                  child: Card(
                    elevation: 2,
                    clipBehavior: Clip.antiAlias,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Stack(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 3,
                              child: SizedBox(
                                width: double.infinity,
                                child: Image.network(
                                  item['cover_image'] ?? 'https://via.placeholder.com/300',
                                  fit: BoxFit.cover,
                                  errorBuilder: (c, e, s) => Container(color: Colors.grey[200], child: const Icon(Icons.image, color: Colors.grey)),
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 2,
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item['name'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    const SizedBox(height: 4),
                                    Text(item['star_rating'] != null ? '${item['star_rating']} ★' : (item['description'] ?? ''), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () => _toggleSave(categoryKey, item['id']),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(color: Colors.black.withOpacity(0.3), shape: BoxShape.circle),
                              child: Icon(isSaved ? Icons.favorite : Icons.favorite_border, color: isSaved ? Colors.redAccent : Colors.white, size: 20),
                            ),
                          ),
                        )
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}