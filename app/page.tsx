'use client';
import Link from 'next/link';
import Image from 'next/image';
import React, {useEffect} from 'react';

export default function MainPage() {
    // proofs to show under the "이렇게 많은 증거 자료가 있습니다." heading
    const proofs = ['/i1.png', '/i2.png', '/i3.png', '/i4.png', '/i5.png', '/i6.png', '/i7.png'];

    // Fade-in on scroll via IntersectionObserver
    useEffect(() => {
        const els = document.querySelectorAll('[data-reveal]');
        const obs = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('opacity-100', 'translate-y-0');
                    obs.unobserve(e.target as Element);
                }
            });
        }, {threshold: 0.15});
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    return (
        <div>
            <div className="relative flex flex-col min-h-screen ">
                {/* Fixed Header */}
                <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur shadow px-4">
                    <div className="mx-auto max-w-7xl h-16 flex items-center justify-between">
                        {/* Left logo (ground.jpg) */}
                        <button
                            type="button"
                            onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                            className="flex items-center gap-2"
                        >
                            <div className="relative w-8 h-8 rounded overflow-hidden ring-1 ring-black/10">
                                <Image src="/ground.jpg" alt="홈" fill className="object-cover" sizes="32px"/>
                            </div>
                        </button>


                        <a href="https://www.youtube.com/@give_me_the_code"><Image src="/youtube.webp"
                                                                                   alt="YouTube Channel" width={40}
                                                                                   height={20}/></a>

                    </div>
                </header>
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-50"
                    style={{backgroundImage: "url('/ground.jpg')"}}
                />
                {/* Hero Section */}
                <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
                        기물락은 존재한다
                    </h1>
                    <div className="flex gap-4">
                        <Link
                            href="/setting"
                            className="px-6 py-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-lg font-semibold text-white"
                        >
                            덱 구성 타임어택
                        </Link>
                    </div>
                </section>
            </div>
            <div>
                {/* Video Section */}
                <section
                    id="videos"
                    className="bg-white py-16 px-4 flex flex-col items-center"
                >
                    <h2 className="text-2xl md:text-4xl font-bold mb-10 text-black">
                        기물락.. 진짜 존재하는건가요..?
                    </h2>
                    <div className="flex flex-col gap-10 max-w-6xl w-full">
                        {proofs.map((src, idx) => {
                            const align = idx % 2 === 0 ? 'justify-start' : 'justify-end'; // alternate left/right
                            return (
                                <div
                                    key={src}
                                    data-reveal
                                    className={`flex ${align} transition-all duration-700 opacity-0 translate-y-6`}
                                >
                                    <div
                                        className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/10"
                                        style={{width: '80%'}} // ≈ 4/7 width
                                        title={`증거 ${idx + 1}`}
                                    >
                                        <img src={src} alt={`증거 ${idx + 1}`} className="w-full h-auto"/>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
            <div>
                <section className="bg-indigo-600 py-16 px-4 text-center text-white">
                    <h2 className="text-2xl md:text-4xl font-bold mb-6">
                        기물락이 없었으면 3성 무조건 띄우는건데..
                    </h2>
                    <p className="mb-8 max-w-2xl mx-auto">
                        100% 랜덤일때 어떻게 되는지 직접 확인해 보세요.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link
                            href="/setting"
                            className="px-6 py-3 rounded-md bg-white text-indigo-600 font-semibold hover:bg-gray-100"
                        >
                            덱 구성 타임어택
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}