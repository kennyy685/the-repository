"""Offline tests for Step 3: property classification, address cleanup, walking order, turfs."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import doors, parcels  # noqa: E402


def house(num, street="36 AVE", lat=41.43, lon=-97.36, score=50.0, hail=1.5):
    return {"house_num": num, "street": street, "city": "Columbus", "unit": "", "lat": lat, "lon": lon,
            "score": score, "hail_in": hail}


class Step3(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(parcels.classify({"Classification_Code": "010105030906"}), ("single", 0))
        self.assertEqual(parcels.classify({"Classification_Code": "020101030307"}), (None, 0))     # vacant lot
        self.assertEqual(parcels.classify({"Property_Parcel_Status": "01", "Property_Parcel_Type": "02"}), ("multi", 0))
        # Lancaster style: type blank, zoning 01 -> single family, marked inferred
        self.assertEqual(parcels.classify({"Classification_Code": "010001010203", "Property_Parcel_Status": "01"}),
                         ("single", 1))
        self.assertEqual(parcels.classify({"Classification_Code": "010505030906", "ImpSF": 0}), (None, 0))  # bare farm

    def test_normalize(self):
        a = {"Ph_Rd_Num": "2947", "Ph_Pre_Dir": "S", "Ph_Rd_Name": "HIGHWAY 77", "Ph_Rd_Type": "",
             "Situs_Address": "2947 S HIGHWAY 77 LOT 25 FREMONT NE 68025-0000"}
        self.assertEqual(parcels.normalize(a), (2947, "S HIGHWAY 77", "Lot 25"))
        b = {"Ph_Rd_Num": "12", "Ph_Rd_Name": "BIG ISLAND", "Ph_Rd_Type": "RD LOT D", "Situs_Address": "12 BIG ISLAND RD LOT D"}
        self.assertEqual(parcels.normalize(b)[1], "BIG ISLAND RD")
        c = {"Situs_Address": "445 HONOR DR  LINCOLN  NE  68510"}
        self.assertEqual(parcels.normalize(c)[:2], (445, "HONOR DR"))

    def test_serpentine(self):
        hs = [house(n) for n in (2254, 2271, 2258, 2265, 2260, 2267)]
        order = [h["house_num"] for h in doors._serpentine(hs)]
        self.assertEqual(order, [2254, 2258, 2260, 2271, 2267, 2265])        # evens up, odds back down
        self.assertEqual([h["house_num"] for h in doors._serpentine(hs, reverse=True)],
                         [2260, 2258, 2254, 2265, 2267, 2271])

    def test_turfs_size_and_hops(self):
        hs = []
        for b in range(6):                                                  # 6 blocks of 20 houses, 0.1 mi apart
            for k in range(20):
                hs.append(house(b * 100 + k * 2 + 2, "18 ST", lat=41.43 + b * 0.00145, lon=-97.36))
        far = [house(10 + 2 * k, "FAR RD", lat=41.60, lon=-97.36, score=90) for k in range(5)]   # 12 mi away
        turfs = doors.build_turfs(hs + far, turf_size=60, max_hop_mi=0.4)
        sizes = sorted(t["doors"] for t in turfs)
        self.assertEqual(sum(sizes), 125)
        self.assertIn(5, sizes)                                             # the far road is its own turf
        self.assertTrue(all(t["doors"] <= 60 for t in turfs if t["streets"] != "Far Rd"))
        self.assertEqual(doors.build_turfs(far, 60)[0]["streets"], "Far Rd")


if __name__ == "__main__":
    unittest.main()
